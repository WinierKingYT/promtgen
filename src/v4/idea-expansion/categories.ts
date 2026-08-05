import type { ProjectDocumentV5 } from '../contracts.js';
import { classifyProjectDomain, type ProjectDomain } from '../ai/domain-classifier.js';

export interface ExpansionCategory {
  id: string;
  label: string;
  hint: string;
  /** AI bağlı değilken gösterilecek başlangıç başlıkları. Pano boş görünmez. */
  seedTitles: string[];
}

/**
 * Kategori sözlüğü deterministiktir: ağ, AI, tarih veya rastgelelik kullanmaz.
 * Domain pack'lerin sözlüğü plan kalite kapısı dilidir ve fikir aşaması için
 * fazla tekniktir; burada kategoriler kullanıcının dilinde adlandırılır.
 */
const CORE: ExpansionCategory[] = [
  {
    id: 'onboarding',
    label: 'Kullanıcı ve ilk deneyim',
    hint: 'İlk 5 dakikada ne olur?',
    seedTitles: ['İlk açılışta tek bir değerli sonuç göster', 'Kayıt olmadan denenebilir bir mod']
  },
  {
    id: 'core-depth',
    label: 'Ana akışı derinleştir',
    hint: 'Çekirdek işi daha iyi ne yapar?',
    seedTitles: ['Ana akışı tek ekrana indir', 'Sık yapılan işi tek tıka indir']
  },
  {
    id: 'data',
    label: 'Veri ve içerik',
    hint: 'Neyi nereden alır, nasıl büyür?',
    seedTitles: ['Veriyi kullanıcıdan toplamadan başlat', 'İçe aktarma ile ilk veriyi doldur']
  },
  {
    id: 'trust',
    label: 'Güven ve gizlilik',
    hint: 'Kullanıcı neden güvensin?',
    seedTitles: ['Verinin nerede durduğunu açıkça göster', 'Tek tıkla dışa aktarma ve silme']
  },
  {
    id: 'money',
    label: 'Para modeli',
    hint: 'Ayakta nasıl kalır?',
    seedTitles: ['Ücretsiz katmanın sınırını netleştir', 'Değeri görülmeden ödeme isteme']
  },
  {
    id: 'growth',
    label: 'Büyüme ve elde tutma',
    hint: 'Neden geri döner?',
    seedTitles: ['Geri dönmeyi hak eden tek bildirim', 'Sonucu paylaşılabilir hâle getir']
  },
  {
    id: 'measure',
    label: 'Ölçüm ve öğrenme',
    hint: 'Doğru gittiğini nereden bilirsin?',
    seedTitles: ['Tek bir kuzey yıldızı metriği seç', 'İlk 20 kullanıcıyla konuşma planı']
  },
  {
    id: 'narrow',
    label: 'Kapsamı daralt',
    hint: 'Neyi çıkarırsan MVP hâlâ ayakta kalır?',
    seedTitles: ['İkincil kullanıcı grubunu ilk sürümden çıkar', 'Otomasyonu elle yapılan adıma indir']
  }
];

const BY_DOMAIN: Record<ProjectDomain, ExpansionCategory[]> = {
  web: [
    {
      id: 'accounts',
      label: 'Hesap ve yetkiler',
      hint: 'Kim neyi görebilir ve değiştirebilir?',
      seedTitles: ['Tek kullanıcıyla başla, ekip desteğini sonraya bırak', 'Rol yerine basit sahiplik kuralı']
    },
    {
      id: 'integrations',
      label: 'Entegrasyonlar',
      hint: 'Hangi araca bağlanırsa değeri artar?',
      seedTitles: ['Tek bir dış araca bağlan', 'Dışa aktarma ile entegrasyonu erteler']
    },
    {
      id: 'a11y',
      label: 'Erişilebilirlik',
      hint: 'Klavye ve ekran okuyucuyla kullanılabilir mi?',
      seedTitles: ['Ana akışı klavyeyle tamamlanabilir yap', 'Renk dışında da ayırt edilebilir durumlar']
    }
  ],
  mobile: [
    {
      id: 'offline',
      label: 'Çevrimdışı ve senkron',
      hint: 'Bağlantı yokken ne olur?',
      seedTitles: ['Son veriyi çevrimdışı göster', 'Çakışmada kullanıcıya sor']
    },
    {
      id: 'permissions',
      label: 'İzinler',
      hint: 'Hangi izni ne zaman isteyeceksin?',
      seedTitles: ['İzni ilk açılışta değil ihtiyaç anında iste', 'İzin reddedilirse çalışan bir yedek akış']
    },
    {
      id: 'notifications',
      label: 'Bildirimler',
      hint: 'Hangi bildirim gerçekten hak edilmiş?',
      seedTitles: ['Tek bir yüksek değerli bildirim', 'Bildirim sıklığını kullanıcı belirlesin']
    }
  ],
  game: [
    {
      id: 'game-loop',
      label: 'Oyun döngüsü',
      hint: 'Oyuncu hangi 30 saniyeyi tekrar eder?',
      seedTitles: ['Çekirdek döngüyü 30 saniyeye indir', 'Tek bir tatmin edici geri bildirim']
    },
    {
      id: 'progression',
      label: 'İlerleme ve ödül',
      hint: 'Oyuncu neyi biriktirir?',
      seedTitles: ['İlk oturumda görülebilir bir ilerleme', 'Ödülü rastgeleliğe bağlama']
    },
    {
      id: 'multiplayer',
      label: 'Çok oyunculu',
      hint: 'Başka oyuncular olmadan da eğlenceli mi?',
      seedTitles: ['Tek oyunculu çekirdeği önce doğrula', 'Asenkron etkileşimle başla']
    }
  ],
  ai: [
    {
      id: 'model-cost',
      label: 'Model ve maliyet',
      hint: 'Her çağrı ne kadara mal oluyor?',
      seedTitles: ['Küçük modelle başla, büyüğe yükselt', 'Sonuçları önbelleğe al']
    },
    {
      id: 'accuracy',
      label: 'Doğruluk',
      hint: 'Model yanılırsa kullanıcı ne görür?',
      seedTitles: ['Belirsizliği kullanıcıya açıkça göster', 'Kaynağı gösterilmeyen çıktıyı sunma']
    },
    {
      id: 'human-approval',
      label: 'İnsan onayı',
      hint: 'Hangi adım onaysız ilerlememeli?',
      seedTitles: ['Kalıcı değişiklikleri onaya bağla', 'Geri alınabilir varsayılan davranış']
    }
  ],
  general: []
};

export function getExpansionCategories(project: ProjectDocumentV5): ExpansionCategory[] {
  const domain = classifyProjectDomain(project.identity.originalIdea || '');
  return [...CORE, ...BY_DOMAIN[domain]];
}
