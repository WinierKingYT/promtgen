import type { ProviderSettings } from '../provider-settings.js';
import type { ExpansionResult } from './idea-expansion-service.js';

/**
 * Bir kategorinin panoda hazır olup olmadığı.
 *
 * `failed` bilerek ayrı bir durumdur: arka planda düşen bir kategori sessizce
 * yutulmaz, ama kullanıcıya bildirim de gösterilmez — chip'in kendi üzerinde
 * görünür, o kadar. Kullanıcı yine tıklayabilir; tıklama yolu üretimi baştan
 * dener ve gerekirse yerel başlangıç kartlarını gösterir.
 */
export type ExpansionReadiness = 'queued' | 'running' | 'ready' | 'failed';

export interface ExpansionPrefetchDeps {
  /**
   * Tek bir kategori için kart üretir. Enjekte edilir: hem üretim yolunun
   * (`generateExpansionCards`) burada ÇOĞALTILMAMASI hem de sıra/iptal
   * davranışının sahte bir görevle ölçülebilmesi için.
   */
  generate(categoryId: string, options: { signal: AbortSignal; refresh: boolean }): Promise<ExpansionResult>;
  /**
   * Arka plan doldurmasının çalışıp çalışmayacağı. Çevrimdışı ayarlarda
   * `false` döner ve sıra HİÇ başlamaz — `runRegisteredAITask`'ın çevrimdışı
   * fırlatmasını kontrol akışı olarak kullanmak yerine ön-kontrol yapılır.
   * Kullanıcının KENDİ tıklamasını (`requestNow`) kapatmaz: orada yerel
   * başlangıç kartları ve "AI bağlı değil" uyarısı doğru cevaptır.
   */
  isEnabled(): boolean;
  /** Durum haritası her değiştiğinde çağrılır. */
  onStatus(statuses: Record<string, ExpansionReadiness>): void;
}

export interface ExpansionPrefetchRunner {
  /**
   * Arka plan sırasını (yeniden) kurar. `generationKey` önbellek anahtarının
   * revizyon kısmıdır; değişmesi "eldeki her şey geçersiz" demektir.
   */
  fill(generationKey: string, categoryIds: readonly string[]): void;
  /**
   * Kullanıcının beklediği üretim. Arka plan sırasını KESER: uçuştaki arka
   * plan işi iptal edilir, bu istek hemen koşar, sonra sıra kaldığı yerden
   * devam eder. `null` yalnız istek iptal edildiğinde (unmount / proje
   * değişimi) döner; çağıran o durumda ekrana hiçbir şey yazmaz.
   */
  requestNow(categoryId: string, refresh?: boolean): Promise<ExpansionResult | null>;
  /** Unmount / proje değişimi: uçuştaki her şey iptal edilir, yayın kesilir. */
  stop(): void;
}

/**
 * Arka planda en fazla bu kadar kategori doldurulur.
 *
 * GEREKÇE. Canlı ölçümde pano ~14 kategori gösteriyor ve kategori başına
 * üretim ~25 saniye sürüyor: hepsini doldurmak yerel modeli ~6 DAKİKA
 * kesintisiz meşgul etmek demek. Bunun bedeli kullanıcının makinesinden
 * ödeniyor ve karşılığı belirsiz — kullanıcı bir oturumda 14 başlığın
 * hepsini okumuyor.
 *
 * 6 şu hesapla seçildi: kullanıcı bir paneli okurken ~2,5 dakika arka plan
 * işi yapılır; bu, otomatik açılan birincil eksenle birlikte panonun
 * "hemen açılan" bölümünü kullanıcının ilk okuma süresine oturtar. Sınırın
 * dışında kalan kategori KAYBOLMAZ: tıklandığında yine üretilir, yalnız
 * beklemek gerekir. Ayrıca fikir her değiştiğinde (kart eklemek de
 * documentRevision'ı artırır) önbellek zaten geçersizleşiyor; daha uzun bir
 * sıranın sonu çoğu zaman hiç kullanılmadan çöpe gidiyordu.
 */
const BACKGROUND_PREFETCH_LIMIT = 6;

/**
 * Çevrimdışı ön-kontrolü. `runRegisteredAITask` çevrimdışı ayarlarda hata
 * fırlatır; bunu yakalayıp kontrol akışı yapmak arka planda 14 kategori için
 * 14 gereksiz hata üretirdi. Ayar önceden okunur — bu kod tabanında yerleşik
 * desen, bkz. `discovery-generation-service.ts` ve `idea-axis-service.ts`.
 */
export function canPrefetchExpansion(settings: ProviderSettings | null | undefined): boolean {
  if (!settings) return false;
  return settings.providerId !== 'offline' && settings.useAiWhenAvailable !== false;
}

export function createExpansionPrefetch(deps: ExpansionPrefetchDeps): ExpansionPrefetchRunner {
  const statuses = new Map<string, ExpansionReadiness>();
  let queue: string[] = [];
  let generationKey = '';
  let pumping = false;
  let stopped = false;
  /**
   * Kullanıcı isteği sürerken arka plan sırası bekler. Sayaç (bayrak değil):
   * kullanıcı hızlı hızlı iki chip'e tıklarsa ikinci istek birincinin
   * bitişinde sırayı yanlışlıkla serbest bırakmasın.
   */
  let priorityDepth = 0;
  let backgroundAbort: AbortController | null = null;
  const priorityAborts = new Set<AbortController>();

  const publish = () => {
    if (stopped) return;
    deps.onStatus(Object.fromEntries(statuses));
  };

  const setStatus = (categoryId: string, state: ExpansionReadiness) => {
    if (statuses.get(categoryId) === state) return;
    statuses.set(categoryId, state);
    publish();
  };

  async function pump(): Promise<void> {
    if (pumping) return;
    pumping = true;
    try {
      // TEK ÜRETİM KURALI bu döngüdedir: sıradaki kategori, bir öncekinin
      // sonucu beklendikten SONRA başlar. Ollama istekleri sıraya alıyor;
      // paralel çağrı kuyrukta bekler ve idea-expansion görevinin 30 sn'lik
      // zaman aşımına takılıp başarısız olurdu.
      while (!stopped && deps.isEnabled() && priorityDepth === 0 && queue.length) {
        const categoryId = queue[0];
        queue = queue.slice(1);
        if (statuses.get(categoryId) === 'ready') continue;

        const jobKey = generationKey;
        const controller = new AbortController();
        backgroundAbort = controller;
        setStatus(categoryId, 'running');
        try {
          await deps.generate(categoryId, { signal: controller.signal, refresh: false });
          if (stopped || controller.signal.aborted || jobKey !== generationKey) continue;
          setStatus(categoryId, 'ready');
        } catch {
          if (stopped) return;
          if (controller.signal.aborted) {
            // İptal bir başarısızlık DEĞİLDİR: ya kullanıcı sırayı atladı ya
            // da fikir değişti. Fikir değiştiyse (jobKey eskidi) bu kategori
            // yeni sırada zaten var; yalnız aynı revizyondaysa başa alınır.
            if (jobKey === generationKey) {
              statuses.set(categoryId, 'queued');
              publish();
              queue = [categoryId, ...queue.filter(item => item !== categoryId)];
            }
            continue;
          }
          // Sessiz yutma yok: kategori "olmadı" damgasıyla izlenebilir kalır
          // ve sıra durmaz — bir kategorinin düşmesi kalanları cezalandırmaz.
          setStatus(categoryId, 'failed');
        } finally {
          if (backgroundAbort === controller) backgroundAbort = null;
        }
      }
    } finally {
      pumping = false;
    }
  }

  function fill(nextKey: string, categoryIds: readonly string[]): void {
    if (stopped) return;
    if (nextKey !== generationKey) {
      generationKey = nextKey;
      // Uçuştaki üretim ESKİ revizyona aittir: önbellek anahtarı
      // documentRevision içerdiği için sonucu yazmak hem boşa yer kaplar hem
      // de bir daha okunmaz. Eldeki "hazır" damgaları da eski anahtara aitti.
      backgroundAbort?.abort();
      backgroundAbort = null;
      statuses.clear();
      publish();
    }

    const next: string[] = [];
    for (const categoryId of categoryIds) {
      if (statuses.get(categoryId) === 'ready') continue;
      if (next.includes(categoryId)) continue;
      next.push(categoryId);
      if (next.length >= BACKGROUND_PREFETCH_LIMIT) break;
    }
    queue = next;
    for (const categoryId of queue) {
      if (!statuses.has(categoryId)) statuses.set(categoryId, 'queued');
    }
    publish();
    void pump();
  }

  async function requestNow(categoryId: string, refresh = false): Promise<ExpansionResult | null> {
    if (stopped) return null;
    priorityDepth += 1;
    // Kullanıcı BEKLİYOR. Arka plan işi ona yol verir; aksi hâlde isteği
    // yerel modelin kuyruğunda sıranın arkasına düşer ve kullanıcı, çözmeye
    // çalıştığımız beklemenin daha uzununu yaşardı.
    backgroundAbort?.abort();
    backgroundAbort = null;

    const controller = new AbortController();
    priorityAborts.add(controller);
    setStatus(categoryId, 'running');
    try {
      const result = await deps.generate(categoryId, { signal: controller.signal, refresh });
      if (stopped || controller.signal.aborted) return null;
      setStatus(categoryId, 'ready');
      return result;
    } catch (error) {
      if (stopped || controller.signal.aborted) return null;
      setStatus(categoryId, 'failed');
      throw error;
    } finally {
      priorityAborts.delete(controller);
      priorityDepth -= 1;
      void pump();
    }
  }

  function stop(): void {
    stopped = true;
    queue = [];
    backgroundAbort?.abort();
    backgroundAbort = null;
    for (const controller of priorityAborts) controller.abort();
    priorityAborts.clear();
    // Zamanlayıcı yok: bu yürütücü hiç `setTimeout`/`setInterval` kurmaz,
    // bu yüzden geride sızacak bir zamanlayıcı da kalmaz. Durdurma yalnız
    // bayrak + iptal sinyalidir.
  }

  return { fill, requestNow, stop };
}
