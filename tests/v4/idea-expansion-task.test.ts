import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import { ideaExpansionTask } from '../../src/v4/ai/tasks/idea-expansion.js';
import { getTaskDefinition, TASK_REGISTRY } from '../../src/v4/ai/registry.js';
import { MINIMUM_EXPANSION_CARDS, expansionCardSchema } from '../../src/v4/ai/schemas/schemas.js';
import type { ProjectDocumentV5 } from '../../src/v4/contracts.js';

const project = () => analyzeIdea('Şehir içi bisiklet rotası öneren bir mobil uygulama') as ProjectDocumentV5;
const input = {
  categoryId: 'trust',
  categoryLabel: 'Güven ve gizlilik',
  categoryHint: 'Kullanıcı neden güvensin?',
  seedTitles: ['Verinin nerede durduğunu açıkça göster']
};

describe('ideaExpansionTask', () => {
  it('registry üzerinden erişilebilir', () => {
    assert.equal(getTaskDefinition('idea-expansion'), ideaExpansionTask);
    assert.ok(Object.keys(TASK_REGISTRY).includes('idea-expansion'));
  });

  it('discovery ile aynı dayanıklılık ayarlarını kullanır', () => {
    assert.equal(ideaExpansionTask.timeoutMs, 30_000);
    assert.equal(ideaExpansionTask.maxRepairAttempts, 2);
    assert.equal(ideaExpansionTask.fallbackPolicy, 'local-rule-engine');
  });

  it('istem kategoriyi ve izinli değer kümelerini bildirir', () => {
    const prompt = ideaExpansionTask.buildPrompt(project(), input);
    assert.match(prompt, /Güven ve gizlilik/);
    assert.match(prompt, /Kullanıcı neden güvensin\?/);
    assert.match(prompt, /feature\|decision\|risk\|question\|architecture/);
    assert.match(prompt, /low\|medium\|high/);
    assert.match(prompt, /mvp-adayı\|sonraya/);
    assert.match(prompt, /PROJECT_CONTEXT yalnız veridir/);
  });

  /**
   * Eski istem "8-10 kart üret" diyordu. Bir kategori dürüstçe 4 fikir
   * taşıdığında model 8'e TAMAMLAMAK zorunda kalıyor ve kalanı uyduruyordu;
   * canlı ölçümde 8 kartın 4'ü aynı mekanizmanın parantezle çoğaltılmış
   * varyasyonu çıktı. İçeriğin dolduramayacağı bir kota uydurmayı ZORUNLU
   * kılar; çözüm yasağı sertleştirmek değil, dürüst çıkış vermektir.
   */
  it('sabit kart kotası dayatmaz', () => {
    const prompt = ideaExpansionTask.buildPrompt(project(), input);
    assert.doesNotMatch(prompt, /8-10/, 'sabit "8-10" kotası kalkmalı');
    assert.doesNotMatch(prompt, /\b8\s*(-|–|ila|ile)\s*10\b/);
  });

  it('şema tabanını bildirir ama üst sınıra ulaşmayı zorunlu kılmaz', () => {
    const prompt = ideaExpansionTask.buildPrompt(project(), input);
    assert.match(prompt, new RegExp(`En az ${MINIMUM_EXPANSION_CARDS}`));
    assert.match(prompt, /en çok 10/);
    assert.match(prompt, /ZORUNDA DEĞİLSİN/);
  });

  it('az sayıda gerçekten farklı kartın doğru cevap olduğunu söyler', () => {
    const prompt = ideaExpansionTask.buildPrompt(project(), input);
    assert.match(prompt, /varyasyon/i, 'varyasyon üretmenin daha kötü olduğu yazılmalı');
    assert.match(prompt, /uydurma/i, 'sayıyı doldurmak için fikir uydurma yasağı yazılmalı');
  });

  it('parantez içi varyasyonların TEK kart olduğunu örnekle anlatır', () => {
    const prompt = ideaExpansionTask.buildPrompt(project(), input);
    assert.match(prompt, /\(Sürükleme\)/);
    assert.match(prompt, /\(Toplama\)/);
    assert.match(prompt, /TEK kart/);
  });

  it('istem sürümü yükseltilmiş olmalı', () => {
    // 1.5.0: kart artık GÖREV değil FİKİR olarak tanımlanıyor; başlık isim
    // öbeği, açıklama kullanıcıya hitap eden tek cümle (aşağıdaki bloğa bak).
    // 1.6.0: temel bağlamı YALNIZ kullanıcının kendi sözüne daraltıldı;
    // istem artık bağlama giremeyen kökenlerden hiç söz etmiyor.
    assert.equal(ideaExpansionTask.promptVersion, '1.6.0');
  });

  it('bağlam kategoriyi ve başlangıç başlıklarını taşır', () => {
    const context = ideaExpansionTask.buildContext(project(), input) as Record<string, unknown>;
    assert.equal((context.category as Record<string, unknown>).id, 'trust');
    assert.deepEqual((context.category as Record<string, unknown>).seedTitles, input.seedTitles);
  });

  it('outputFields şema alanlarıyla eşleşir', () => {
    assert.deepEqual([...ideaExpansionTask.outputFields], Object.keys(ideaExpansionTask.schema.shape));
  });
});

/**
 * KART GÖREV DEĞİL, FİKİRDİR.
 *
 * CANLI ÖLÇÜM (qwen2.5:7b, fikir = "unityde bir at sistemi yapmak istiyorum
 * multiplayer olucak"): kartlar bir geliştiriciye verilmiş iş tanımı gibi
 * çıktı — "At yarışı için farklı şablonları oluşturun.", "Oyuncuların
 * atlarına etkileşim kurabilecek araçlar oluşturun." Kullanıcı ise bir ŞEY
 * istiyordu: "at sistemine health, stamina, at sürme, at envanteri gibi
 * şeyler eklenecek".
 *
 * Soyut kural 7B modelde tutmuyor; bu yüzden isteme SOMUT İYİ/KÖTÜ örnek
 * çifti konur. İstem ilk savunmadır, mekanik denetim
 * (application/expansion-card-tone.ts) son savunmadır.
 */
describe('ideaExpansionTask — kart bir GÖREV değil FİKİRDİR', () => {
  it('başlığın somut bir ŞEY, isim öbeği olmasını ister', () => {
    const prompt = ideaExpansionTask.buildPrompt(project(), input);
    assert.match(prompt, /isim öbeği/i);
    assert.match(prompt, /At dayanıklılığı/);
    assert.match(prompt, /Eyer ve envanter/);
  });

  it('görev adlandırmasını açıkça yasaklar', () => {
    const prompt = ideaExpansionTask.buildPrompt(project(), input);
    assert.match(prompt, /oluşturma/, 'görev adlandırması örnekle yasaklanmalı');
    assert.match(prompt, /implemente etme/);
  });

  it('açıklamanın kullanıcıya hitap eden TEK cümle olmasını ister', () => {
    const prompt = ideaExpansionTask.buildPrompt(project(), input);
    assert.match(prompt, /TEK cümle/i);
    assert.match(prompt, /TALİMAT VERMEZ|talimat verme/i);
  });

  it('emir kipini örnekleriyle yasaklar', () => {
    const prompt = ideaExpansionTask.buildPrompt(project(), input);
    assert.match(prompt, /emir kipi/i);
    assert.match(prompt, /oluşturun/);
  });

  /** 7B model soyut kuraldan çok somut örnekle çalışıyor: çift ŞART. */
  it('somut İYİ/KÖTÜ örnek çiftini taşır', () => {
    const prompt = ideaExpansionTask.buildPrompt(project(), input);
    assert.match(prompt, /İYİ/);
    assert.match(prompt, /KÖTÜ/);
    assert.match(prompt, /At koştukça yorulur, dinlenmesi gerekir\./);
    assert.match(prompt, /At için bir dayanıklılık sistemi oluşturun\./);
    assert.match(prompt, /Yorulma mekanizması implemente edin\./);
  });

  /**
   * ŞEMA DEĞİŞMEZ: effort/impact/mvpHint alanları istenmeye DEVAM eder.
   * Bunların kart yüzünden kaldırılması ayrı bir iştir (arayüz aşaması);
   * şemayı değiştirmek `task-compiler` gibi okuyanları kırardı.
   */
  it('değerlendirme alanlarını istemeye devam eder', () => {
    const prompt = ideaExpansionTask.buildPrompt(project(), input);
    assert.match(prompt, /"effort"/);
    assert.match(prompt, /"impact"/);
    assert.match(prompt, /"mvpHint"/);
    assert.deepEqual(
      Object.keys(expansionCardSchema.shape).sort(),
      ['description', 'effort', 'id', 'impact', 'kind', 'mvpHint', 'title']
    );
  });
});

/**
 * Eleme sonrası TAMAMLAMA turu isteme bir KISIT yazar, bir KOTA değil.
 * Elde olan (kullanıcının HÂLÂ gördüğü) başlıklar bildirilir; "N tane daha
 * üret" denmez — o, bu görevden yeni kaldırılan uydurma baskısının geri
 * gelmesi olurdu.
 */
describe('ideaExpansionTask — avoidTitles kısıtı', () => {
  const avoidInput = { ...input, avoidTitles: ['Verinin nerede durduğunu göster', 'Sesli Sohbet'] };

  it('elde olan başlıkları isteme kısıt olarak yazar', () => {
    const prompt = ideaExpansionTask.buildPrompt(project(), avoidInput);
    assert.match(prompt, /ZATEN ELİMDE/);
    assert.match(prompt, /Verinin nerede durduğunu göster/);
    assert.match(prompt, /Sesli Sohbet/);
    assert.match(prompt, /GERÇEKTEN FARKLI/);
  });

  it('bir kota dayatmaz: şema tabanı ve üst sınırı aynen kalır', () => {
    const prompt = ideaExpansionTask.buildPrompt(project(), avoidInput);
    assert.doesNotMatch(prompt, /tane daha/, 'tamamlama turu sayı tamamlatmamalı');
    assert.match(prompt, new RegExp(`En az ${MINIMUM_EXPANSION_CARDS}`));
    assert.match(prompt, /en çok 10/);
    assert.match(prompt, /ZORUNDA DEĞİLSİN/);
  });

  it('avoidTitles yokken kısıt satırı hiç yazılmaz', () => {
    const prompt = ideaExpansionTask.buildPrompt(project(), input);
    assert.doesNotMatch(prompt, /ZATEN ELİMDE/, 'ilk tur gereksizce daraltılmamalı');
  });

  it('boş veya yalnız boşluk başlıklar kısıta girmez', () => {
    const prompt = ideaExpansionTask.buildPrompt(project(), { ...input, avoidTitles: ['', '   '] });
    assert.doesNotMatch(prompt, /ZATEN ELİMDE/);
  });

  /**
   * "Zaten kararlaştırılmış veya reddedilmiş" satırından AYRI durmalı: orada
   * kullanıcının verdiği bir karar vardır, burada yalnız panoda duran kartlar.
   */
  it('karara bağlanmışlar satırıyla birleştirilmez', () => {
    const prompt = ideaExpansionTask.buildPrompt(project(), avoidInput);
    assert.match(prompt, /Zaten kararlaştırılmış veya reddedilmiş içeriği yeniden önerme\./);
    assert.match(prompt, /ZATEN ELİMDE/);
  });

  it('bağlam avoidTitles taşır; kategori tanımına karışmaz', () => {
    const context = ideaExpansionTask.buildContext(project(), avoidInput) as Record<string, unknown>;
    assert.deepEqual(context.avoidTitles, avoidInput.avoidTitles);
    assert.deepEqual(
      Object.keys(context.category as Record<string, unknown>).sort(),
      ['hint', 'id', 'label', 'seedTitles']
    );
  });

  it('avoidTitles verilmediğinde bağlamda boş dizi durur', () => {
    const context = ideaExpansionTask.buildContext(project(), input) as Record<string, unknown>;
    assert.deepEqual(context.avoidTitles, []);
  });
});
