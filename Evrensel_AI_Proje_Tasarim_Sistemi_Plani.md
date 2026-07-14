# Evrensel AI Proje Tasarım ve Agent Hazırlama Sistemi

> **Çalışma adı:** Project Architect AI  
> **Belge türü:** Ürün vizyonu, sistem tasarımı ve geliştirme ana planı  
> **Sürüm:** 1.0  
> **Durum:** İlk kapsamlı tasarım  
> **Öncelik:** Local-first masaüstü uygulaması  
> **Uzun vadeli yön:** Yerel proje planlayıcısından proje geliştirme orkestratörüne dönüşmek

---

## İçindekiler

1. [Yönetici Özeti](#1-yönetici-özeti)
2. [Projenin Temel Vizyonu](#2-projenin-temel-vizyonu)
3. [Çözülmek İstenen Problemler](#3-çözülmek-istenen-problemler)
4. [Ürünün Temel İlkeleri](#4-ürünün-temel-ilkeleri)
5. [Sistemin Destekleyeceği Proje Biçimleri](#5-sistemin-destekleyeceği-proje-biçimleri)
6. [Kategori Seçmeden Proje Algılama](#6-kategori-seçmeden-proje-algılama)
7. [Evrensel Proje Modeli](#7-evrensel-proje-modeli)
8. [Proje Karmaşıklığı ve Planlama Derinliği](#8-proje-karmaşıklığı-ve-planlama-derinliği)
9. [Ana Kullanıcı Akışı](#9-ana-kullanıcı-akışı)
10. [Planlama Motorunun Aşamaları](#10-planlama-motorunun-aşamaları)
11. [Uzman Modül Sistemi](#11-uzman-modül-sistemi)
12. [Proje Hafızası ve Karar Sistemi](#12-proje-hafızası-ve-karar-sistemi)
13. [Değişiklik Etki Analizi](#13-değişiklik-etki-analizi)
14. [Belge, Kural, Skill ve Prompt Üretimi](#14-belge-kural-skill-ve-prompt-üretimi)
15. [Görev Üretim Sistemi](#15-görev-üretim-sistemi)
16. [Reviewer ve Kalite Kontrol Sistemi](#16-reviewer-ve-kalite-kontrol-sistemi)
17. [Mevcut Projeleri Analiz Etme](#17-mevcut-projeleri-analiz-etme)
18. [Yerel Dosya Sistemi ve Güvenlik](#18-yerel-dosya-sistemi-ve-güvenlik)
19. [Kullanıcı Arayüzü Tasarımı](#19-kullanıcı-arayüzü-tasarımı)
20. [Teknik Mimari](#20-teknik-mimari)
21. [Önerilen Teknoloji Yığını](#21-önerilen-teknoloji-yığını)
22. [Veri Modeli](#22-veri-modeli)
23. [Klasör ve Kod Organizasyonu](#23-klasör-ve-kod-organizasyonu)
24. [LLM Sağlayıcı Sistemi](#24-llm-sağlayıcı-sistemi)
25. [Prompt Mimarisi](#25-prompt-mimarisi)
26. [Agent ve IDE Export Sistemi](#26-agent-ve-ide-export-sistemi)
27. [MVP Kapsamı](#27-mvp-kapsamı)
28. [Geliştirme Yol Haritası](#28-geliştirme-yol-haritası)
29. [Test ve Değerlendirme Stratejisi](#29-test-ve-değerlendirme-stratejisi)
30. [Başarı Ölçütleri](#30-başarı-ölçütleri)
31. [Riskler ve Önlemler](#31-riskler-ve-önlemler)
32. [Gelecekte Bulut Sürümüne Geçiş](#32-gelecekte-bulut-sürümüne-geçiş)
33. [Örnek Kullanım Senaryoları](#33-örnek-kullanım-senaryoları)
34. [İlk Uygulama Kararları](#34-ilk-uygulama-kararları)
35. [Sonuç](#35-sonuç)

---

# 1. Yönetici Özeti

Bu proje, kullanıcının doğal dille anlattığı **herhangi bir yazılım veya dijital ürün fikrini** analiz eden, geliştiren, uygulanabilir bir plana dönüştüren ve AI kodlama agent’larının kullanabileceği proje paketlerini oluşturan local-first bir masaüstü uygulamasıdır.

Kullanıcının başlangıçta proje kategorisi seçmesi gerekmeyecektir. Kullanıcı yalnızca yapmak istediği şeyi anlatacaktır:

- Bir tanıtım sitesi
- Bir web uygulaması
- Mobil uygulama
- Masaüstü yazılımı
- CLI aracı
- Küçük otomasyon scripti
- Büyük veri işleme sistemi
- 2D veya 3D video oyunu
- Yapay zekâ destekli ürün
- Birden fazla platform içeren karmaşık sistem
- Mevcut bir projeye yeni özellik
- Var olan projenin yeniden tasarlanması

Sistem fikri analiz ederek projenin ihtiyaçlarını çıkaracak, uygun planlama derinliğini belirleyecek ve gerekli uzman modülleri otomatik olarak etkinleştirecektir.

Sistemin temel çıktısı yalnızca tek bir büyük prompt olmayacaktır. Bunun yerine aşağıdaki gibi düzenli ve yaşayan bir proje paketi oluşturulacaktır:

```text
project-workspace/
├── AGENTS.md
├── MASTER_PROMPT.md
├── README.md
├── docs/
│   ├── PROJECT_BRIEF.md
│   ├── REQUIREMENTS.md
│   ├── ARCHITECTURE.md
│   ├── TECH_STACK.md
│   ├── RISKS.md
│   └── TEST_STRATEGY.md
├── tasks/
│   ├── TASK-001.md
│   ├── TASK-002.md
│   └── ...
├── rules/
│   ├── general.md
│   ├── security.md
│   ├── testing.md
│   └── ...
├── skills/
│   ├── project-architect/
│   │   └── SKILL.md
│   └── ...
└── .project-architect/
    ├── state.json
    ├── decisions.json
    ├── versions/
    └── history/
```

İlk sürüm local-first olacaktır:

- Kullanıcı hesabı gerektirmeyecektir.
- Proje verileri kullanıcının bilgisayarında tutulacaktır.
- SQLite ve proje klasörü birlikte kullanılacaktır.
- Yerel model veya kullanıcının seçtiği bulut modeli kullanılabilecektir.
- Dosya değişiklikleri kullanıcı onayı olmadan uygulanmayacaktır.
- Üretilen dosyalar Cursor, Claude Code, Codex, Cline, Copilot ve benzeri agent’lara aktarılabilecektir.

Uzun vadede sistem üç aşamalı bir ürüne dönüşebilir:

1. **Project Planner:** Fikri ve projeyi planlar.
2. **Project Reviewer:** Planı veya mevcut projeyi inceler.
3. **Project Orchestrator:** Agent görevlerini, sonuçlarını ve proje ilerlemesini yönetir.

---

# 2. Projenin Temel Vizyonu

## 2.1 Ürün vizyonu

> Kullanıcının aklındaki dağınık fikri, kategori veya teknik bilgi zorunluluğu olmadan; araştırılmış, tutarlı, uygulanabilir ve AI geliştirme agent’larının anlayabileceği yaşayan bir proje sistemine dönüştürmek.

## 2.2 Ürün tanımı

Bu ürün bir sohbet botu, basit prompt oluşturucu veya sabit şablon üreticisi değildir.

Ürün şu rollerin birleşimi gibi çalışacaktır:

- Ürün yöneticisi
- İş analisti
- Sistem mimarı
- Yazılım mimarı
- Oyun tasarımcısı
- Teknik proje yöneticisi
- UX planlayıcısı
- Güvenlik değerlendiricisi
- Test planlayıcısı
- Prompt mühendisi
- Agent workflow tasarımcısı
- Teknik reviewer

Sistem her projede bütün rolleri kullanmayacaktır. Projenin yapısına göre gerekli rolleri ve planlama modüllerini etkinleştirecektir.

## 2.3 Sistemin ana vaadi

Yanlış ve gerçekçi olmayan vaat:

> Tek tıkla kusursuz uygulama oluşturur.

Doğru ürün vaadi:

> Yapmak istediğin projeyi anlamana, geliştirilebilir hâle getirmenize ve AI agent’ları için kontrollü bir uygulama planına dönüştürmene yardımcı olur.

## 2.4 Ürünün uzun vadeli konumu

Sistem zaman içinde şu seviyelere ulaşabilir:

```text
Fikir Danışmanı
      ↓
Proje Planlayıcısı
      ↓
Teknik Mimar
      ↓
Agent Paketi Üreticisi
      ↓
Proje Reviewer
      ↓
Agent Görev Yöneticisi
      ↓
Yerel AI Geliştirme Orkestratörü
```

---

# 3. Çözülmek İstenen Problemler

## 3.1 Kullanıcının ne yapmak istediğini tam anlatamaması

Kullanıcı çoğu zaman yalnızca genel bir fikre sahiptir:

> Discord benzeri ama oyun ekipleri için bir uygulama yapmak istiyorum.

Bu tanımda hedef kullanıcı, özellik sınırları, platformlar, güvenlik, ölçek, gelir modeli ve teknik gereksinimler belli değildir.

Sistem bu fikri konuşma ve yapılandırılmış analiz yoluyla olgunlaştırmalıdır.

## 3.2 AI kodlama agent’larına yetersiz talimat verilmesi

Kullanıcılar genellikle agent’a şu tür talimatlar verir:

> Bana komple bir uygulama yap.

Bu, agent’ın şu hataları yapmasına yol açabilir:

- Gereksiz özellik eklemek
- Yanlış teknoloji seçmek
- Birbirini tutmayan dosyalar oluşturmak
- Test yazmamak
- Büyük görevleri tamamlanmış gibi göstermek
- Mimariyi sık sık değiştirmek
- Güvenlik kontrollerini atlamak
- Kapsam dışına çıkmak

Sistem agent’a proje, görev ve alan bazında kontrollü bağlam sağlamalıdır.

## 3.3 Belgelerin birbiriyle çelişmesi

Bağımsız üretilen belgelerde şu tür çelişkiler oluşabilir:

- Mimari belgesinde PostgreSQL, görevlerde MongoDB bulunması
- Web uygulaması planında mobil gereksinimlerin unutulması
- Kullanıcı rolleri tanımlanmasına rağmen API yetkilerinin belirtilmemesi
- Oyun tasarımında save sistemi bulunmasına rağmen veri formatının planlanmaması

Belgeler yapılandırılmış tek bir proje state’inden üretilmeli ve export öncesinde tutarlılık kontrolünden geçmelidir.

## 3.4 Her projeye aynı şablonun uygulanması

Basit bir dosya yeniden adlandırma scripti ile çok oyunculu 3D bir oyun aynı planlama sürecine sahip olmamalıdır.

Sistem:

- Projenin karmaşıklığını ölçmeli
- Planlama seviyesini ayarlamalı
- Gereksiz belgeleri üretmemeli
- Kritik belgeleri eksik bırakmamalı

## 3.5 Proje kararlarının kaybolması

Uzun sohbetlerde şu kararların kaybolması yaygındır:

- Neden bir teknoloji seçildi?
- Bir özellik neden MVP’den çıkarıldı?
- Hangi varsayımlar yapıldı?
- Hangi riskler kabul edildi?
- Bir karar değişirse nereler etkilenir?

Bu nedenle sistemde karar, varsayım, risk ve değişiklik geçmişi ayrı olarak saklanmalıdır.

---

# 4. Ürünün Temel İlkeleri

## 4.1 Kategori zorunluluğu olmayacak

Kullanıcı başlangıçta web, mobil, oyun veya script seçmeyecektir. Sistem doğal dildeki fikirden gerekli sinyalleri çıkaracaktır.

## 4.2 Proje türü tek bir etiket olmayacak

Bir proje aynı anda şu özelliklere sahip olabilir:

- Mobil istemci
- Web yönetim paneli
- Backend API
- AI işleme hattı
- Masaüstü editörü
- Oyun istemcisi

Bu nedenle sistem tek bir `projectType` alanına değil, çok boyutlu proje profiline dayanacaktır.

## 4.3 Önce ihtiyaç, sonra teknoloji

Sistem önce React, Unity, Godot, Python veya Rust seçmeyecektir.

Önce şunları belirleyecektir:

- Platform
- Etkileşim modeli
- Gerçek zamanlılık
- Performans ihtiyacı
- Veri modeli
- Offline gereksinimi
- Donanım erişimi
- Güvenlik
- Dağıtım biçimi
- Kullanıcının deneyimi
- Bakım beklentisi

Teknoloji seçimi bu ihtiyaçlardan sonra yapılacaktır.

## 4.4 Yapılandırılmış state ana kaynak olacak

Sohbet geçmişi tek bilgi kaynağı olmayacaktır. Önemli bilgiler proje state’ine dönüştürülecektir.

## 4.5 AI doğrudan kritik değişiklik uygulamayacak

AI:

1. Değişiklik önerecek
2. Diff oluşturacak
3. Etkilenen alanları gösterecek
4. Kullanıcı onayı isteyecek
5. Onaydan sonra dosyayı güncelleyecektir

## 4.6 Sistem açıklanabilir kararlar verecek

Her önemli öneri şu sorulara cevap vermelidir:

- Ne öneriliyor?
- Neden öneriliyor?
- Faydası nedir?
- Dezavantajı nedir?
- Alternatifler nelerdir?
- MVP için gerekli midir?
- Hangi karar ve görevleri etkiler?

## 4.7 Local-first, cloud-ready

İlk sürüm yerel çalışacak; ancak mimari ileride bulut, takım çalışması ve senkronizasyon eklenebilecek şekilde adapter tabanlı olacaktır.

---

# 5. Sistemin Destekleyeceği Proje Biçimleri

Sistem teorik olarak herhangi bir yazılım veya dijital ürün fikrini planlayabilmelidir.

## 5.1 Web projeleri

- Statik tanıtım sitesi
- Blog veya içerik platformu
- E-ticaret
- SaaS uygulaması
- Yönetim paneli
- Sosyal platform
- Gerçek zamanlı iş birliği aracı
- Marketplace
- Dashboard
- API tabanlı web istemcisi

## 5.2 Mobil uygulamalar

- Basit yardımcı araç
- Offline uygulama
- Sosyal uygulama
- Konum tabanlı uygulama
- Kamera ve sensör kullanan uygulama
- Abonelik tabanlı mobil ürün
- Web ve mobil birlikte çalışan sistem

## 5.3 Masaüstü uygulamaları

- Dosya yöneticisi
- Editör
- Yerel yapay zekâ arayüzü
- Medya işleme aracı
- Geliştirici aracı
- Oyun editörü
- Çok platformlu üretkenlik yazılımı

## 5.4 Script ve otomasyonlar

- Dosya düzenleme
- Veri dönüştürme
- Yedekleme
- Rapor üretme
- Web scraping
- CLI aracı
- Sistem yönetimi
- Toplu medya işleme
- API otomasyonu
- Tek seferlik migration scripti

## 5.5 Video oyunları

- 2D platform oyunu
- 3D oyun
- Hikâye tabanlı oyun
- Strateji oyunu
- Simülasyon
- Roguelike
- Bulmaca
- Mobil oyun
- Çok oyunculu oyun
- Oyun prototipi
- Oyun içi araç veya editör

## 5.6 Yapay zekâ projeleri

- Sohbet asistanı
- RAG sistemi
- Agent sistemi
- Doküman analiz aracı
- Görsel üretim arayüzü
- Ses işleme sistemi
- Sınıflandırma veya tahmin servisi
- AI destekli oyun sistemi
- Model değerlendirme aracı
- Yerel model yönetim uygulaması

## 5.7 Backend ve altyapı projeleri

- REST veya GraphQL API
- Mikroservis
- Queue tabanlı worker
- Veri pipeline’ı
- Entegrasyon servisi
- Kimlik doğrulama sistemi
- Event-driven platform
- İç araç
- Observability servisi

## 5.8 Karma projeler

Örnek:

> Mobil uygulamadan kontrol edilen, web paneli bulunan, masaüstünde içerik hazırlanan ve AI ile video üreten bir sistem.

Sistem projeyi tek kategoriye sıkıştırmak yerine alt sistemlere ayırmalıdır:

```text
Ürün
├── Mobil istemci
├── Web yönetim paneli
├── Masaüstü içerik editörü
├── Backend API
├── AI video işleme hattı
├── Job queue
├── Dosya depolama
└── Bildirim servisi
```

---

# 6. Kategori Seçmeden Proje Algılama

## 6.1 Kullanıcının başlangıç deneyimi

Ana ekranda kategori listesi yerine tek bir temel alan bulunmalıdır:

> Ne yapmak istiyorsun? Fikrini bildiğin kadar anlat.

Kullanıcı çok kısa veya çok uzun yazabilir.

Örnek:

> Klasördeki görselleri boyutlandırıp WebP yapan bir araç.

veya:

> Oyuncuların kendi uzay gemilerini tasarladığı, ekonomisi oyuncular tarafından yönetilen ve farklı gezegenlerde üs kurabildiği çevrim içi bir oyun.

## 6.2 Intent Analyzer

İlk modül kullanıcının fikrini doğrudan çözümlemeye çalışır.

Örnek çıktı:

```json
{
  "summary": "Klasördeki görselleri toplu olarak dönüştüren yerel araç",
  "desiredOutcome": "Görselleri belirli ölçülere getirip WebP formatına dönüştürmek",
  "detectedCapabilities": [
    "filesystem-access",
    "batch-processing",
    "image-transformation"
  ],
  "likelyInterfaces": [
    "cli",
    "desktop-gui"
  ],
  "uncertainties": [
    "Tek komutluk script mi yoksa görsel arayüz mü isteniyor?",
    "Kaynak dosyalar korunacak mı?"
  ]
}
```

## 6.3 Project Profiler

Sistem tek bir kategori yerine proje boyutlarını çıkarır.

```json
{
  "platforms": ["desktop"],
  "interfaces": ["gui"],
  "interactionModel": "tool",
  "runtimeModel": "on-demand",
  "dataCharacteristics": ["local-files"],
  "networkRequirements": [],
  "performanceSensitivity": "medium",
  "securitySensitivity": "low",
  "contentScale": "small",
  "collaboration": "single-user",
  "deployment": "local-installation",
  "domains": [
    {
      "name": "desktop-utility",
      "confidence": 0.92
    },
    {
      "name": "media-processing",
      "confidence": 0.88
    }
  ]
}
```

## 6.4 Capability tabanlı planlama

Planlama modülleri kategoriye göre değil, yeteneklere göre seçilmelidir.

Örnek sinyaller:

```text
filesystem-access
authentication
payments
real-time-networking
3d-rendering
offline-storage
push-notifications
background-jobs
ai-inference
rag
mod-support
save-system
plugin-system
camera-access
location-services
high-volume-data
```

Bu yaklaşım sayesinde sistem daha önce tanımlanmamış karma proje fikirlerini de planlayabilir.

---

# 7. Evrensel Proje Modeli

Tüm projelerin temel bilgileri ortak bir şemada tutulmalıdır.

```json
{
  "identity": {
    "name": "",
    "summary": "",
    "problem": "",
    "desiredOutcome": "",
    "vision": ""
  },
  "projectProfile": {
    "domains": [],
    "platforms": [],
    "interfaces": [],
    "capabilities": [],
    "runtimeModel": "",
    "complexity": {}
  },
  "people": {
    "targetUsers": [],
    "stakeholders": [],
    "roles": []
  },
  "scope": {
    "mustHave": [],
    "shouldHave": [],
    "couldHave": [],
    "notNow": [],
    "explicitlyOutOfScope": []
  },
  "requirements": {
    "functional": [],
    "nonFunctional": [],
    "domainSpecific": []
  },
  "workflows": [],
  "systems": [],
  "components": [],
  "data": {
    "entities": [],
    "flows": [],
    "storageNeeds": [],
    "retentionRules": []
  },
  "interfaces": [],
  "integrations": [],
  "technologyDecisions": [],
  "constraints": [],
  "assumptions": [],
  "risks": [],
  "decisions": [],
  "openQuestions": [],
  "tasks": [],
  "tests": [],
  "documents": [],
  "rules": [],
  "skills": [],
  "versions": []
}
```

## 7.1 Ortak alanlar

Her projede en az şu soruların cevabı aranmalıdır:

- Ne yapılacak?
- Neden yapılacak?
- Kim kullanacak?
- Kullanıcı hangi sonucu elde edecek?
- Projenin sınırları nedir?
- Hangi girdileri alacak?
- Hangi çıktıları üretecek?
- Nerede çalışacak?
- Hangi riskleri taşıyor?
- Nasıl doğrulanacak?
- Tamamlandığı nasıl anlaşılacak?

## 7.2 Alan özel uzantılar

Evrensel model, uzman modüllerin ek alanlar tanımlamasına izin vermelidir.

Oyun uzantısı:

```json
{
  "gameDesign": {
    "genre": [],
    "coreLoop": [],
    "playerGoals": [],
    "mechanics": [],
    "progression": [],
    "levels": [],
    "narrative": {},
    "artDirection": {},
    "audioDirection": {},
    "performanceBudget": {}
  }
}
```

Mobil uzantısı:

```json
{
  "mobile": {
    "targetDevices": [],
    "permissions": [],
    "offlineBehavior": {},
    "notifications": {},
    "storeRelease": {}
  }
}
```

Script uzantısı:

```json
{
  "automation": {
    "inputs": [],
    "outputs": [],
    "failureModes": [],
    "idempotency": "",
    "executionModes": [],
    "safetyRules": []
  }
}
```

---

# 8. Proje Karmaşıklığı ve Planlama Derinliği

## 8.1 Neden adaptif derinlik gerekli?

Her proje için aynı miktarda belge ve soru üretmek hem kullanıcının zamanını boşa harcar hem de gereksiz token tüketir.

Sistem projenin karmaşıklığını ölçerek bir planlama profili oluşturmalıdır.

## 8.2 Karmaşıklık boyutları

Karmaşıklık skoru yalnızca kod miktarına göre hesaplanmamalıdır.

```text
Alt sistem sayısı
Platform sayısı
Kullanıcı rolü sayısı
Veri karmaşıklığı
Gerçek zamanlılık
Güvenlik hassasiyeti
Entegrasyon sayısı
İçerik üretim yükü
Grafik ve performans ihtiyacı
Offline çalışma
Dağıtım hedefleri
Takım büyüklüğü
Uzun süreli bakım
Regülasyon gereksinimi
Belirsizlik miktarı
```

## 8.3 Planlama seviyeleri

### Quick

Kullanım alanı:

- Küçük script
- Tek iş yapan CLI aracı
- Basit prototip
- Küçük statik site
- Deneysel oyun mekaniği

Üretilecek temel dosyalar:

```text
PROJECT.md
IMPLEMENTATION_PLAN.md
TASKS.md
TEST_CASES.md
AGENTS.md
```

### Standard

Kullanım alanı:

- Orta ölçekli web uygulaması
- Mobil uygulama
- Masaüstü yardımcı araç
- Küçük veya orta oyun
- API servisi

Üretilecek belgeler:

```text
PROJECT_BRIEF.md
REQUIREMENTS.md
USER_FLOWS.md
ARCHITECTURE.md
TECH_STACK.md
TASKS.md
TEST_STRATEGY.md
AGENTS.md
rules/
skills/
```

### Advanced

Kullanım alanı:

- Karma platform
- Büyük oyun
- AI sistemi
- Çok sayıda entegrasyon
- Geniş içerik yapısı
- Karmaşık veri akışları

Ek belgeler:

```text
SYSTEM_CONTEXT.md
SUBSYSTEMS.md
DATA_MODEL.md
API_SPEC.md
SECURITY_MODEL.md
PERFORMANCE_BUDGET.md
RISK_REGISTER.md
ADR/
TASK_DEPENDENCIES.md
EVALUATION_PLAN.md
```

### Enterprise

Kullanım alanı:

- Yüksek güvenlik
- Büyük ekip
- Çok yüksek trafik
- Kritik iş süreçleri
- Regülasyon
- Çoklu ortam ve disaster recovery

Ek belgeler:

```text
THREAT_MODEL.md
CAPACITY_PLAN.md
OBSERVABILITY.md
DISASTER_RECOVERY.md
MIGRATION_STRATEGY.md
COMPLIANCE_MATRIX.md
SERVICE_OWNERSHIP.md
RELEASE_GOVERNANCE.md
```

## 8.4 Otomatik öneri, kullanıcı kontrolü

Sistem bir seviye önermelidir:

> Bu proje için Standard planlama yeterli görünüyor. İki platform ve AI özelliği eklersen Advanced seviyeye geçilmesi önerilir.

Kullanıcı isterse derinliği artırabilir veya azaltabilir.

---

# 9. Ana Kullanıcı Akışı

```text
1. Yeni proje oluştur
2. Fikri doğal dille anlat
3. Sistem ilk proje profilini çıkarsın
4. Belirsiz ve önemli konular için sorular sorsun
5. Sistem geliştirme önerileri sunsun
6. Kullanıcı önerileri kabul etsin, reddetsin veya düzenlesin
7. MVP kapsamı oluşturulsun
8. Teknik yaklaşımlar karşılaştırılsın
9. Mimari ve alt sistemler planlansın
10. Görevler ve bağımlılıklar oluşturulsun
11. Kurallar, skill’ler ve agent dosyaları üretinsin
12. Reviewer planı değerlendirsin
13. Kullanıcı önerilen değişiklikleri onaylasın
14. Dosya diff’leri gösterilsin
15. Proje paketi seçilen klasöre yazılsın
16. İstenirse IDE agent formatına export edilsin
```

## 9.1 Kullanıcının her öneri üzerindeki kontrolü

Her öneri şu işlemleri desteklemelidir:

- Kabul et
- Reddet
- Düzenle
- Sonraya bırak
- Alternatif üret
- Nedenini açıkla
- Etki analizini göster

## 9.2 Sistem çok fazla soru sormamalı

Sistem her turda yalnızca en yüksek bilgi değerine sahip 3–5 soruyu sormalıdır.

Öncelik sırası:

1. Projenin yönünü değiştirecek sorular
2. Güvenlik ve veri kaybı riski taşıyan sorular
3. MVP kapsamını etkileyen sorular
4. Teknoloji seçimini etkileyen sorular
5. Görsel veya küçük tercihler

---

# 10. Planlama Motorunun Aşamaları

Sistem serbest ve kontrolsüz sohbet yerine bir workflow motoru üzerinden çalışmalıdır.

## 10.1 Workflow durumları

```text
IDEA_CAPTURED
PROFILE_DRAFTED
DISCOVERY_IN_PROGRESS
SCOPE_DRAFTED
MVP_DEFINED
REQUIREMENTS_DRAFTED
TECH_OPTIONS_READY
TECH_STACK_SELECTED
ARCHITECTURE_DRAFTED
TASKS_DRAFTED
AGENT_PACKAGE_DRAFTED
REVIEW_IN_PROGRESS
READY_FOR_EXPORT
EXPORTED
IMPLEMENTATION_TRACKING
```

## 10.2 Her aşamanın sözleşmesi

Her aşama şunlara sahip olmalıdır:

- Gerekli girdiler
- Çalıştırılacak prompt
- Kullanılacak uzman modüller
- Beklenen JSON şeması
- Çıkış kriterleri
- Oluşturulacak veya güncellenecek state alanları
- Kullanıcı onayı gerekip gerekmediği
- Sonraki olası aşamalar

## 10.3 Ana planlama aşamaları

### Aşama A — Fikir yakalama

Çıktı:

- İlk özet
- Beklenen sonuç
- Proje sinyalleri
- Belirsiz noktalar

### Aşama B — Keşif

Çıktı:

- Kullanıcılar
- Kullanım senaryoları
- Gereksinimler
- Kısıtlar
- Başarı ölçütleri
- Açık sorular

### Aşama C — Fikir geliştirme

Çıktı:

- Geliştirilebilecek özellikler
- Basitleştirme önerileri
- Alternatif ürün yönleri
- Değer ve maliyet analizi

### Aşama D — Kapsam ve MVP

Çıktı:

- Must Have
- Should Have
- Could Have
- Not Now
- Açıkça kapsam dışı alanlar

### Aşama E — Teknik seçenekler

En az üç yaklaşım:

1. En hızlı ve basit
2. Dengeli ve sürdürülebilir
3. En yüksek ölçek veya performans

### Aşama F — Mimari

Çıktı:

- Sistem bağlamı
- Alt sistemler
- Bileşenler
- Veri akışları
- Arayüzler
- Storage
- Güvenlik
- Test
- Deployment

### Aşama G — Görevler

Çıktı:

- Epic’ler
- Görevler
- Bağımlılıklar
- Kabul kriterleri
- Doğrulama planı

### Aşama H — Agent paketi

Çıktı:

- Belgeler
- Kurallar
- Skill’ler
- Global talimatlar
- Görev promptları
- IDE formatları

### Aşama I — Reviewer

Çıktı:

- Tutarsızlıklar
- Eksiklikler
- Riskler
- Aşırı karmaşıklıklar
- Önerilen düzeltmeler

---

# 11. Uzman Modül Sistemi

## 11.1 Modül yaklaşımı

Sistem tek bir dev prompt içinde bütün proje türlerini çözmeye çalışmamalıdır.

```text
Evrensel Planlama Çekirdeği
            ↓
Capability ve risk analizi
            ↓
Gerekli uzman modüllerin seçimi
            ↓
Ortak proje state’inin güncellenmesi
```

## 11.2 Evrensel modüller

Her projede kullanılabilecek modüller:

- Intent Analyzer
- Project Profiler
- Discovery Planner
- Requirement Analyst
- Scope Manager
- Complexity Estimator
- Risk Analyst
- Technology Evaluator
- Architecture Planner
- Task Decomposer
- Document Planner
- Rule Generator
- Skill Generator
- Consistency Reviewer
- Export Planner

## 11.3 Web modülleri

- Web UX Planner
- Frontend Architecture
- Backend Architecture
- API Design
- Database Design
- Authentication Planner
- SEO Planner
- Accessibility Reviewer
- Web Deployment Planner

## 11.4 Mobil modülleri

- Mobile UX Planner
- Device Capability Planner
- Offline Strategy
- Permission Planner
- Notification Planner
- Store Release Planner
- Mobile Performance Reviewer

## 11.5 Oyun modülleri

- Game Vision Designer
- Core Loop Designer
- Gameplay Systems Designer
- Level Design Planner
- Narrative Designer
- Economy and Progression Designer
- AI Behavior Planner
- Save System Designer
- Asset Pipeline Planner
- Audio Planner
- Multiplayer Architecture
- Performance Budget Reviewer
- Playtest Planner

## 11.6 Script ve otomasyon modülleri

- Input/Output Analyzer
- CLI Designer
- Filesystem Safety Reviewer
- Error and Recovery Planner
- Idempotency Reviewer
- Scheduling Planner
- Packaging and Distribution Planner

## 11.7 AI sistemi modülleri

- Model Selection Advisor
- Prompt Designer
- RAG Planner
- Agent Workflow Designer
- Evaluation Planner
- Safety and Guardrail Reviewer
- Token and Cost Planner
- Data Privacy Reviewer

## 11.8 Modül seçme kuralları

Her modül için bir manifest bulunabilir:

```yaml
id: save-system-designer
activates_when:
  any_capability:
    - save-system
    - persistent-player-progress
requires:
  - project-profile
  - gameplay-systems
produces:
  - save-model
  - failure-scenarios
  - save-test-plan
incompatible_with: []
priority: 70
```

## 11.9 Modül çakışmalarını yönetme

Örnek:

- `offline-first-storage` ile `always-online-client` aynı projede çelişebilir.
- `server-authoritative-multiplayer` ile `peer-to-peer-only` aynı karar alanında birlikte seçilmemelidir.

Sistem bu çakışmaları kullanıcıya göstermelidir.

---

# 12. Proje Hafızası ve Karar Sistemi

## 12.1 Sohbet ve state ayrımı

Sohbet:

- Kullanıcının doğal dildeki düşüncelerini saklar.
- Açıklama ve tartışma için kullanılır.

Project state:

- Onaylanmış gerçekleri ve kararları saklar.
- Belge ve görev üretiminde ana kaynaktır.

## 12.2 Karar kaydı

```json
{
  "id": "DEC-012",
  "title": "Masaüstü uygulama çatısı",
  "topic": "desktop-framework",
  "decision": "Tauri kullanılacak",
  "reason": "Local-first masaüstü hedefi ve sınırlı yetki modeli",
  "alternatives": [
    "Electron",
    "Yerel web uygulaması"
  ],
  "status": "approved",
  "affectedAreas": [
    "architecture",
    "filesystem",
    "packaging"
  ],
  "createdAt": "2026-07-14T18:00:00Z"
}
```

## 12.3 Varsayım kaydı

```json
{
  "id": "ASM-004",
  "text": "İlk sürüm tek kullanıcı tarafından kullanılacak",
  "confidence": "high",
  "status": "active",
  "affectedDecisions": [
    "DEC-002",
    "DEC-006"
  ],
  "reviewTrigger": "Cloud veya takım desteği eklendiğinde"
}
```

## 12.4 Açık soru kaydı

```json
{
  "id": "Q-010",
  "question": "İlk MVP mevcut projeleri tarayacak mı?",
  "importance": "high",
  "blocks": [
    "MVP scope",
    "filesystem permissions"
  ],
  "status": "open"
}
```

## 12.5 Risk kaydı

```json
{
  "id": "RISK-007",
  "title": "Gizli dosyaların modele gönderilmesi",
  "probability": "medium",
  "impact": "critical",
  "mitigation": [
    ".env ve anahtar dosyalarını engelle",
    "Gönderilecek dosyaları önizlet",
    "Workspace dışına erişimi kapat"
  ],
  "status": "mitigated"
}
```

---

# 13. Değişiklik Etki Analizi

## 13.1 Amaç

Kullanıcı bir kararı değiştirdiğinde sistem yalnızca bir cümleyi güncellememelidir.

Örnek değişiklik:

> Uygulama sadece lokal değil, takım tarafından bulut üzerinden de kullanılacak.

Bu karar şunları etkileyebilir:

- Kimlik doğrulama
- Yetkilendirme
- Veritabanı
- Senkronizasyon
- Conflict resolution
- Şifreleme
- API
- Deployment
- Kullanıcı arayüzü
- Görev listesi
- Test planı
- Maliyet
- Gizlilik

## 13.2 Etki analiz çıktısı

```text
Değişiklik: Tek kullanıcı local uygulamadan takım destekli hibrit sisteme geçiş

Etki seviyesi: Yüksek

Etkilenen belgeler:
- PROJECT_BRIEF.md
- REQUIREMENTS.md
- ARCHITECTURE.md
- SECURITY_MODEL.md
- DATA_MODEL.md
- TASKS.md

Etkilenen kararlar:
- DEC-002 Yerel veri saklama
- DEC-008 Kullanıcı hesabı gerekmemesi

Yeni ihtiyaçlar:
- Authentication
- Project membership
- Role-based access
- Sync engine
- Conflict handling

Görev etkisi:
- 7 görev güncellenmeli
- 11 yeni görev oluşturulmalı
- 2 görev geçersiz hâle geliyor
```

## 13.3 Dependency graph

Kararlar, gereksinimler, bileşenler, belgeler ve görevler arasında ilişki tutulmalıdır.

```text
Requirement
   ↓
Architecture component
   ↓
Technology decision
   ↓
Task
   ↓
Generated document
   ↓
Test case
```

Bu grafik etki analizinin temelini oluşturur.

---

# 14. Belge, Kural, Skill ve Prompt Üretimi

## 14.1 Tek tip belge paketi kullanılmayacak

Sistem önce bir **Document Plan** oluşturacaktır.

```json
{
  "documents": [
    {
      "type": "project-brief",
      "filename": "PROJECT_BRIEF.md",
      "required": true,
      "reason": "Projenin amacı ve kapsamını tanımlamak"
    },
    {
      "type": "game-design-document",
      "filename": "GAME_DESIGN_DOCUMENT.md",
      "required": true,
      "reason": "Proje oyun mekaniği ve oyuncu deneyimi içeriyor"
    }
  ]
}
```

## 14.2 Örnek oyun paketi

```text
PROJECT_BRIEF.md
GAME_VISION.md
GAME_DESIGN_DOCUMENT.md
CORE_GAMEPLAY_LOOP.md
GAMEPLAY_SYSTEMS.md
LEVEL_DESIGN.md
NARRATIVE_DESIGN.md
ART_DIRECTION.md
AUDIO_DIRECTION.md
ASSET_PIPELINE.md
TECHNICAL_ARCHITECTURE.md
SAVE_SYSTEM.md
PERFORMANCE_BUDGET.md
PLAYTEST_PLAN.md
TASKS.md
AGENTS.md
```

## 14.3 Örnek script paketi

```text
PROJECT.md
INPUT_OUTPUT_SPEC.md
SAFETY_RULES.md
IMPLEMENTATION_PLAN.md
TEST_CASES.md
TASKS.md
AGENTS.md
```

## 14.4 Örnek web uygulaması paketi

```text
PROJECT_BRIEF.md
PRODUCT_REQUIREMENTS.md
USER_ROLES.md
USER_FLOWS.md
ARCHITECTURE.md
TECH_STACK.md
DATA_MODEL.md
API_SPEC.md
SECURITY_MODEL.md
TEST_STRATEGY.md
DEPLOYMENT.md
TASKS.md
AGENTS.md
```

## 14.5 Kural dosyaları

Kural dosyaları projeye göre dinamik oluşturulmalıdır.

Ortak kurallar:

```text
rules/general.md
rules/security.md
rules/testing.md
rules/documentation.md
rules/git-workflow.md
```

Alan kuralları:

```text
rules/frontend.md
rules/backend.md
rules/mobile.md
rules/gameplay.md
rules/game-performance.md
rules/filesystem-safety.md
rules/ai-evaluation.md
```

## 14.6 Skill dosyaları

Her skill tek ve açık bir sorumluluğa sahip olmalıdır.

```markdown
# Gameplay Systems Developer Skill

## Purpose
Onaylanmış oyun tasarımına göre oynanış sistemlerini geliştirmek.

## Required Inputs
- GAME_DESIGN_DOCUMENT.md
- GAMEPLAY_SYSTEMS.md
- rules/gameplay.md
- rules/testing.md

## Responsibilities
- Oyun mekaniğini uygulamak
- Sistemler arasındaki entegrasyonu korumak
- Debug araçları eklemek
- Oyun içi durumları test etmek

## Constraints
- Tasarım belgesinde olmayan mekanik ekleme
- Performans bütçesini aşma
- Save formatını izinsiz değiştirme

## Quality Checklist
- Kabul kriterleri sağlandı
- Edge case testleri yazıldı
- Frame-time etkisi ölçüldü
- Save/load uyumluluğu kontrol edildi

## Output Format
- Değiştirilen dosyalar
- Uygulanan davranışlar
- Test sonuçları
- Performans notları
- Bilinen sorunlar
```

---

# 15. Görev Üretim Sistemi

## 15.1 Görevlerin özellikleri

Görevler:

- Küçük
- Doğrulanabilir
- Bağımlılıkları açık
- Kapsamı sınırlı
- Gerekli bağlamı belirtilmiş
- Test edilebilir
- Agent’ın tek çalışma oturumunda ilerleyebileceği boyutta

olmalıdır.

## 15.2 Evrensel görev şeması

```json
{
  "id": "TASK-CORE-003",
  "title": "Proje profili şemasını oluştur",
  "objective": "",
  "contextFiles": [],
  "requirements": [],
  "implementationNotes": [],
  "acceptanceCriteria": [],
  "outOfScope": [],
  "dependencies": [],
  "risks": [],
  "verificationSteps": [],
  "expectedOutputs": [],
  "status": "todo"
}
```

## 15.3 İyi görev örneği

```markdown
# TASK-FS-004 — Güvenli workspace taraması

## Amaç
Kullanıcının seçtiği proje klasöründeki planlama açısından önemli dosyaları güvenli biçimde listelemek.

## Gerekli Bağlam
- ARCHITECTURE.md
- SECURITY_MODEL.md
- rules/filesystem-safety.md

## Gereksinimler
- Yalnızca seçilen workspace içinde çalışmalı.
- Ignore kurallarına uymalı.
- Sembolik linklerle workspace dışına çıkmamalı.
- Dosya boyutu sınırını uygulamalı.
- Gizli dosyaları varsayılan olarak modele göndermemeli.

## Kabul Kriterleri
- `.git`, `node_modules`, build ve secret dosyaları atlanıyor.
- Workspace dışına erişim engelleniyor.
- Taranan ve atlanan dosyalar raporlanıyor.
- Birim testleri ve geçici klasör entegrasyon testleri geçiyor.

## Kapsam Dışı
- Dosya içeriğini LLM’e göndermek
- Dosya değiştirmek
- Git geçmişini analiz etmek

## Bağımlılıklar
- TASK-CORE-002
- TASK-SEC-001
```

## 15.4 Görev bağımlılık grafiği

Sistem görevleri yalnızca liste olarak değil graph olarak saklamalıdır.

```text
TASK-CORE-001
      ↓
TASK-DB-001
      ↓
TASK-PROJECT-001
      ├── TASK-AI-001
      └── TASK-FS-001
              ↓
        TASK-EXPORT-001
```

## 15.5 Agent çalışma paketleri

Agent’a bütün proje yerine görev için gerekli minimum bağlam verilmelidir.

```text
Task prompt
+ İlgili gereksinimler
+ İlgili mimari bölümleri
+ Alan kuralı
+ İlgili skill
+ Kabul kriterleri
+ Kapsam dışı alanlar
```

Bu yaklaşım bağlam karmaşasını ve gereksiz değişiklikleri azaltır.

---

# 16. Reviewer ve Kalite Kontrol Sistemi

## 16.1 Reviewer doğrudan değiştirmemeli

Reviewer önce tespit oluşturmalıdır.

```text
Tespit
Neden önemli
Etkilenen alanlar
Önerilen çözüm
Risk seviyesi
Kullanıcı kararı
```

## 16.2 Kontrol alanları

### Gereksinim kontrolü

- Belirsiz gereksinim var mı?
- Gereksinimler test edilebilir mi?
- Ana kullanıcı akışları eksik mi?
- Edge case’ler düşünülmüş mü?

### Kapsam kontrolü

- MVP gereğinden büyük mü?
- İlk sürüme ait olmayan özellikler bulunuyor mu?
- Kapsam dışı alanlar açık mı?

### Mimari kontrolü

- Bileşen sorumlulukları net mi?
- Gereksiz mikroservis veya dağıtık yapı var mı?
- Teknoloji seçimleri ihtiyaçlarla uyumlu mu?
- Veri akışlarında eksik bağlantı var mı?

### Güvenlik kontrolü

- Gizli dosya ve anahtar yönetimi
- Kullanıcı izinleri
- Dosya erişim sınırları
- Input validation
- Yetkilendirme
- Veri saklama ve silme

### Görev kontrolü

- Görevler çok büyük mü?
- Bağımlılıklar doğru mu?
- Kabul kriterleri ölçülebilir mi?
- Kapsam dışı alanlar belirtilmiş mi?

### Belge tutarlılığı

- Teknoloji isimleri tutarlı mı?
- Aynı özelliğin farklı belgelerde farklı davranışı var mı?
- Rol ve izinler uyumlu mu?
- Test planı gereksinimleri kapsıyor mu?

## 16.3 Proje sağlık skoru

```text
Genel Sağlık: 82/100

Fikir netliği: 88
Gereksinim tamamlılığı: 79
MVP odaklılık: 91
Mimari tutarlılık: 84
Görev uygulanabilirliği: 76
Güvenlik kapsamı: 70
Test planı: 75
Belge tutarlılığı: 85
```

Skorun yanında her zaman gerekçe ve iyileştirme önerileri bulunmalıdır.

---

# 17. Mevcut Projeleri Analiz Etme

Bu özellik ilk MVP’den sonra ürünün en değerli geliştirmelerinden biri olacaktır.

## 17.1 Kullanım akışı

1. Kullanıcı mevcut repository veya klasörü seçer.
2. Sistem güvenli dosya envanteri çıkarır.
3. Teknolojileri ve proje yapısını algılar.
4. Önemli dosyaları analiz için seçer.
5. Mevcut mimariyi çıkarır.
6. Eksik belgeleri ve riskleri raporlar.
7. Geliştirme planı üretir.
8. Kullanıcı onayıyla agent dosyaları ekler.

## 17.2 İncelenebilecek dosyalar

```text
README.md
package.json
pyproject.toml
Cargo.toml
go.mod
project.godot
*.uproject
*.csproj
Dockerfile
docker-compose.yml
tsconfig.json
src/
tests/
docs/
AGENTS.md
CLAUDE.md
.cursor/
.github/
database schemas
.env.example
```

## 17.3 Analiz çıktıları

- Projenin görünen amacı
- Teknoloji envanteri
- Mimari harita
- Modül ve bağımlılık yapısı
- Test durumu
- Dokümantasyon eksikleri
- Güvenlik riskleri
- Teknik borçlar
- Agent kurallarındaki eksikler
- Refactor önerileri
- Yeni özellik fırsatları
- Öncelikli görev listesi

## 17.4 Gizlilik ilkesi

Dosya içeriği kullanıcı onayı olmadan bulut modeline gönderilmemelidir.

Sistem şunu açıkça göstermelidir:

```text
Analiz için seçilen 18 dosya
Yerel olarak işlenecek: 10
Bulut modeline gönderilecek: 8
Engellenen gizli dosya: 4
Toplam tahmini token: 32.000
```

---

# 18. Yerel Dosya Sistemi ve Güvenlik

## 18.1 Temel güvenlik modeli

Varsayılan olarak sistem:

- Yalnızca kullanıcının seçtiği klasöre erişir.
- Workspace dışına çıkmaz.
- Mevcut dosyaları otomatik silmez.
- Üzerine yazmadan önce diff gösterir.
- Gizli dosyaları filtreler.
- Büyük ve gereksiz klasörleri taramaz.
- Sembolik linkleri kontrol eder.
- Yürütülebilir komutları kullanıcı onayı olmadan çalıştırmaz.

## 18.2 Varsayılan ignore kuralları

```gitignore
.git/
node_modules/
dist/
build/
.next/
target/
Library/
Temp/
.vscode/
.idea/
.env
.env.*
*.pem
*.key
*.p12
credentials.json
service-account*.json
secrets/
coverage/
*.log
```

Kullanıcı bu listeyi proje bazında düzenleyebilmelidir.

## 18.3 Diff akışı

```text
AI yeni içerik önerir
        ↓
Uygulama mevcut dosyayla karşılaştırır
        ↓
Satır bazlı veya bölüm bazlı diff gösterir
        ↓
Kullanıcı:
- Uygula
- Düzenle ve uygula
- Reddet
- Yeni dosya olarak kaydet
        ↓
Snapshot oluşturulur
        ↓
Dosya yazılır
```

## 18.4 Snapshot sistemi

```text
.project-architect/
└── history/
    ├── 0001-initial-plan/
    ├── 0002-mvp-approved/
    ├── 0003-tech-stack-changed/
    └── 0004-reviewer-updates/
```

## 18.5 Komut çalıştırma sınırları

İleride komut çalıştırma eklenirse:

- Varsayılan kapalı olmalı
- Komut tam olarak gösterilmeli
- Çalışma klasörü gösterilmeli
- Riskli komutlar engellenmeli
- Timeout uygulanmalı
- Çıktı ve exit code kaydedilmeli
- Kullanıcı iptal edebilmeli

---

# 19. Kullanıcı Arayüzü Tasarımı

## 19.1 Ana düzen

```text
┌────────────────────┬──────────────────────────────┬──────────────────────┐
│ Proje Navigasyonu  │ AI Çalışma Alanı             │ Proje Hafızası       │
│                    │                              │                      │
│ Genel Bakış        │ Sohbet                       │ Kararlar             │
│ Gereksinimler      │ Sorular                      │ Varsayımlar          │
│ Özellikler         │ Öneriler                     │ Açık Sorular         │
│ Sistemler          │ Karşılaştırmalar             │ Riskler              │
│ Teknoloji          │ Reviewer Bulguları           │ Sağlık Skoru         │
│ Mimari             │ Diff Önizleme                │ Son Değişiklikler    │
│ Görevler           │                              │                      │
│ Belgeler           │                              │                      │
└────────────────────┴──────────────────────────────┴──────────────────────┘
```

## 19.2 Ana ekranlar

### Projeler

- Yeni proje
- Mevcut klasörü aç
- Son projeler
- Arşivlenen projeler
- Proje sağlık özeti

### Fikir ve keşif

- Doğal dil girişi
- AI soruları
- Proje profil özeti
- Belirsizlikler
- Kabul edilen öneriler

### Kapsam

- Must Have
- Should Have
- Could Have
- Not Now
- Kapsam dışı
- Sürükle-bırak önceliklendirme

### Teknoloji

- İhtiyaçlar
- Teknoloji adayları
- Karşılaştırma
- Seçim gerekçesi
- Karar geçmişi

### Mimari

- Alt sistem listesi
- Bileşen kartları
- Veri akışı
- İlişki grafiği
- Risk göstergeleri

### Görevler

- Epic görünümü
- Kanban
- Bağımlılık grafiği
- Agent prompt önizlemesi
- Kabul kriterleri
- Tamamlanma raporları

### Belgeler

- Markdown editörü
- Üretilen dosyalar
- Diff
- Sürümler
- Export hedefi

### Ayarlar

- Model sağlayıcısı
- Yerel model endpoint’i
- API anahtarları
- Varsayılan workspace
- Ignore kuralları
- Güvenlik izinleri
- Planlama derinliği
- Dil tercihi

## 19.3 Chat tek kontrol yüzeyi olmayacak

Chat açıklama ve tartışma için kullanılacaktır. Onaylanmış proje verileri kartlar, tablolar ve yapılandırılmış editörler üzerinden yönetilecektir.

---

# 20. Teknik Mimari

## 20.1 Katmanlar

```text
Presentation Layer
    ↓
Application Layer
    ↓
Domain Layer
    ↓
Infrastructure Adapters
```

## 20.2 Presentation Layer

Sorumlulukları:

- Kullanıcı arayüzü
- Formlar
- Chat görünümü
- State görüntüleme
- Diff
- Proje grafikleri
- Ayarlar

## 20.3 Application Layer

Use case’ler:

```text
CreateProject
AnalyzeIdea
GenerateDiscoveryQuestions
ApplyUserDecision
DefineMvpScope
GenerateTechOptions
ApproveTechnologyDecision
GenerateArchitecture
GenerateTasks
RunReview
PrepareExport
ApplyFileChanges
CreateSnapshot
```

## 20.4 Domain Layer

Ana domain nesneleri:

```text
Project
ProjectProfile
Requirement
Feature
Decision
Assumption
Risk
ArchitectureComponent
Task
Document
Rule
Skill
ReviewFinding
ProjectVersion
```

Domain katmanı UI, Tauri, SQLite ve belirli bir LLM SDK’sına bağımlı olmamalıdır.

## 20.5 Infrastructure Layer

Adapter’lar:

```text
SQLiteProjectRepository
FilesystemWorkspaceStorage
TauriSecureSecretStorage
OllamaProvider
OpenAICompatibleProvider
MarkdownDocumentRenderer
GenericAgentExporter
CursorExporter
ClaudeCodeExporter
CodexExporter
GitAdapter
```

## 20.6 Temel veri akışı

```text
Kullanıcı mesajı
      ↓
Input normalizasyonu
      ↓
Project State özeti
      ↓
Workflow aşamasının belirlenmesi
      ↓
Modül seçimi
      ↓
LLM çağrısı
      ↓
Şema doğrulama
      ↓
State patch önerisi
      ↓
Tutarlılık kontrolü
      ↓
Kullanıcı onayı
      ↓
State güncelleme
      ↓
Belge invalidation ve yeniden üretim
```

## 20.7 State patch yaklaşımı

Model bütün state’i yeniden yazmamalıdır.

Örnek:

```json
{
  "operation": "add",
  "path": "/scope/mustHave/-",
  "value": {
    "id": "FEAT-007",
    "title": "Proje klasörüne Markdown export"
  },
  "reason": "MVP'nin temel çıktısı"
}
```

Bu yaklaşım değişiklikleri denetlenebilir ve geri alınabilir yapar.

---

# 21. Önerilen Teknoloji Yığını

## 21.1 Masaüstü uygulama

```text
Tauri 2
React
TypeScript
Vite
```

Tauri, masaüstü paketleme ve yerel yetenekleri izin/capability yaklaşımıyla sınırlandırma açısından bu local-first proje için uygun bir başlangıçtır. Dosya sistemi erişimi yalnızca seçilen alanlarla sınırlandırılmalıdır.

## 21.2 Kullanıcı arayüzü

```text
Tailwind CSS
shadcn/ui veya benzer erişilebilir bileşen yaklaşımı
TanStack Query
Zustand veya reducer tabanlı yerel UI state
React Hook Form
Zod
```

UI bileşen kütüphanesi proje domain’ine bağlanmamalıdır.

## 21.3 Yerel veri

```text
SQLite
Drizzle ORM
JSON alanları + ilişkisel çekirdek tablolar
```

SQLite, local-first tek kullanıcı uygulamasında ayrı bir veritabanı sunucusu gerektirmeden proje listesi, sohbet, kararlar ve sürüm metadata’sı için uygundur.

## 21.4 Dosya sistemi

```text
Tauri file system plugin
Rust tarafında güvenli path doğrulama
Workspace allowlist
Atomic write
Snapshot ve diff
```

## 21.5 LLM katmanı

```text
Ollama
OpenAI uyumlu endpoint
Bulut sağlayıcı adapter’ları
Structured output validation
Streaming
Retry ve timeout
```

Ollama, yerel API üzerinden modellerle çalışmaya imkân verdiği için offline veya gizlilik odaklı kullanım seçeneği sağlayabilir.

## 21.6 Markdown ve export

```text
Template engine
Markdown AST işlemleri
ZIP export
Agent-specific exporter adapters
```

## 21.7 Test

```text
Vitest
React Testing Library
Playwright
Rust unit/integration tests
Temporary filesystem tests
Golden-file document tests
JSON schema tests
Prompt evaluation dataset
```

## 21.8 İlk sürümde kullanılmaması önerilen yapılar

- Mikroservis
- Kubernetes
- Redis
- Uzak veritabanı
- Zorunlu kullanıcı hesabı
- Çoklu organizasyon
- Marketplace
- Karmaşık event bus
- Otomatik kod çalıştırma

---

# 22. Veri Modeli

## 22.1 Ana tablolar

```text
projects
project_states
project_versions
conversations
messages
requirements
features
decisions
assumptions
risks
open_questions
architecture_components
tasks
task_dependencies
documents
rules
skills
review_findings
ai_runs
exports
settings
```

## 22.2 `projects`

```text
id
name
summary
workspace_path
current_stage
planning_level
created_at
updated_at
archived_at
```

## 22.3 `project_states`

```text
id
project_id
schema_version
state_json
revision
created_at
```

## 22.4 `ai_runs`

```text
id
project_id
workflow_stage
module_id
provider
model
prompt_version
input_tokens
output_tokens
duration_ms
estimated_cost
status
error_code
created_at
```

## 22.5 `documents`

```text
id
project_id
type
relative_path
content_hash
source_revision
status
generated_at
manually_edited_at
```

## 22.6 Dosya ve veritabanı sorumluluğu

SQLite:

- Proje indeksi
- Chat
- AI çağrıları
- Workflow durumu
- Karar ilişkileri
- Versiyon metadata’sı
- Uygulama ayarları

Proje klasörü:

- Markdown belgeleri
- Agent talimatları
- Görev dosyaları
- Kural ve skill dosyaları
- Taşınabilir state exportu
- Snapshot dosyaları

---

# 23. Klasör ve Kod Organizasyonu

```text
project-architect/
├── apps/
│   └── desktop/
│       ├── src/
│       │   ├── app/
│       │   ├── features/
│       │   │   ├── projects/
│       │   │   ├── discovery/
│       │   │   ├── scope/
│       │   │   ├── architecture/
│       │   │   ├── tasks/
│       │   │   ├── documents/
│       │   │   ├── reviews/
│       │   │   └── settings/
│       │   ├── components/
│       │   └── routes/
│       └── src-tauri/
├── packages/
│   ├── domain/
│   ├── project-schema/
│   ├── workflow-engine/
│   ├── module-registry/
│   ├── prompt-engine/
│   ├── llm-providers/
│   ├── document-generator/
│   ├── agent-exporters/
│   ├── consistency-engine/
│   ├── diff-engine/
│   └── shared/
├── modules/
│   ├── universal/
│   ├── web/
│   ├── mobile/
│   ├── game/
│   ├── automation/
│   └── ai/
├── templates/
│   ├── documents/
│   ├── rules/
│   ├── skills/
│   └── agents/
├── evals/
├── fixtures/
└── docs/
```

## 23.1 Neden monorepo?

- Domain ve UI ayrımını korur.
- Exporter ve prompt engine tekrar kullanılabilir.
- Gelecekte CLI veya web istemcisi eklenebilir.
- Test fixture’ları modüller arasında paylaşılabilir.

İlk sürümde monorepo aşırı karmaşık gelirse aynı sınırlar tek repository içinde klasörlerle korunabilir.

---

# 24. LLM Sağlayıcı Sistemi

## 24.1 Sağlayıcı bağımsız arayüz

```typescript
interface LLMProvider {
  id: string;

  testConnection(): Promise<ProviderHealth>;

  generateText(
    request: TextGenerationRequest
  ): Promise<TextGenerationResponse>;

  generateStructured<T>(
    request: StructuredGenerationRequest,
    schema: RuntimeSchema<T>
  ): Promise<T>;

  streamText(
    request: TextGenerationRequest
  ): AsyncIterable<TextChunk>;

  listModels?(): Promise<ModelInfo[]>;
}
```

## 24.2 Routing

Farklı işler farklı modellerle çalışabilir.

```text
Kısa sınıflandırma → hızlı yerel model
Soru üretimi → orta model
Mimari planlama → güçlü model
Reviewer → ayrı veya güçlü model
Doküman biçimlendirme → daha ucuz model
```

## 24.3 Model profil sistemi

Her model için özellik kaydı:

```json
{
  "id": "local-model-x",
  "supportsStructuredOutput": true,
  "supportsToolUse": false,
  "contextWindow": 32768,
  "preferredTasks": [
    "classification",
    "summarization"
  ]
}
```

## 24.4 Hata yönetimi

- Timeout
- Rate limit
- Geçersiz JSON
- Şema uyuşmazlığı
- Model bulunamadı
- Context sınırı
- Bağlantı hatası
- Kullanıcı iptali

Şema hatasında bütün isteği kör şekilde tekrarlamak yerine validation hataları modele düzeltme bağlamı olarak gönderilebilir.

## 24.5 Gizlilik modu

Kullanıcı şu modları seçebilir:

```text
Tamamen yerel
Yerel ön işleme + bulut planlama
Tam bulut
Dosya içerikleri yerel, özetler bulut
```

---

# 25. Prompt Mimarisi

## 25.1 Tek dev prompt kullanılmamalı

Prompt katmanları:

```text
System policy
+ Workflow stage prompt
+ Specialist module prompt
+ Project state slice
+ User input
+ Output schema
+ Validation feedback
```

## 25.2 Project state slicing

Her modül yalnızca ihtiyaç duyduğu state bölümünü almalıdır.

Örnek:

`Game Economy Designer` için:

- Game vision
- Core loop
- Progression
- Target audience
- Monetization constraints
- Existing economy decisions

Gereksiz olarak bütün sohbet geçmişi verilmemelidir.

## 25.3 Prompt versiyonlama

Her prompt:

```text
id
version
purpose
input schema
output schema
compatible modules
test fixtures
change notes
```

bilgisine sahip olmalıdır.

## 25.4 Prompt injection ve dosya içerikleri

Mevcut proje analizi sırasında repository içindeki metinler güvenilmeyen veri olarak ele alınmalıdır.

- Dosya içindeki “önceki talimatları yok say” türü metinler sistem talimatı kabul edilmemeli.
- Kaynak kod ve doküman içerikleri açıkça veri blokları içinde verilmelidir.
- Gizli içerik filtreleme prompttan önce yapılmalıdır.

---

# 26. Agent ve IDE Export Sistemi

## 26.1 İç format agent bağımsız olacak

Ana kaynak:

```text
Project State
Document Plan
Rules
Skills
Tasks
Decisions
```

Exporter’lar bu veriyi hedef araca göre dönüştürecektir.

## 26.2 Hedef formatlar

```text
Generic Agent → AGENTS.md
Claude Code → CLAUDE.md
Cursor → .cursor/rules/*.mdc
Cline → .clinerules
GitHub Copilot → .github/copilot-instructions.md
Codex → AGENTS.md ve görev dosyaları
```

Hedef araçların formatları değişebileceği için exporter’lar versiyonlanmalıdır.

## 26.3 Export profili

```json
{
  "target": "generic",
  "includeDocuments": true,
  "includeTasks": true,
  "includeSkills": true,
  "includeRules": true,
  "taskPromptMode": "one-file-per-task",
  "overwritePolicy": "show-diff"
}
```

## 26.4 MASTER_PROMPT içeriği

Ana prompt şunları söylemelidir:

- Önce ilgili belgeleri oku.
- Yalnızca seçilen görevi uygula.
- Kapsam dışı özellik ekleme.
- Yeni bağımlılık eklemeden önce gerekçe sun.
- Kritik mimari kararı değiştirme.
- Testleri çalıştır.
- Güvenlik kurallarına uy.
- Görev sonunda yapılandırılmış rapor ver.
- Sonraki göreve otomatik geçme.
- Belirsizlik varsa tahminini açıkça belirt.

---

# 27. MVP Kapsamı

## 27.1 MVP amacı

> Kullanıcının doğal dille anlattığı bir proje fikrini kategori seçmeden analiz etmek, yapılandırılmış bir proje planına dönüştürmek ve seçilen klasöre agent uyumlu Markdown paketi olarak yazmak.

## 27.2 MVP’de olması gerekenler

### Proje yönetimi

- Yeni yerel proje oluşturma
- Workspace klasörü seçme
- Proje listesini SQLite’ta tutma
- Projeyi yeniden açma

### AI keşif

- Fikir girişi
- İlk proje profili
- Belirsizlik çıkarımı
- 3–5 soruluk keşif turları
- Kullanıcı cevaplarını state’e işleme

### Planlama

- Gereksinim üretimi
- Must/Should/Could/Not Now
- Karmaşıklık seviyesi
- Teknoloji seçenekleri
- Basit mimari
- Görev üretimi

### Agent paketi

- PROJECT_BRIEF.md
- REQUIREMENTS.md
- ARCHITECTURE.md
- TECH_STACK.md
- TASKS.md
- AGENTS.md
- MASTER_PROMPT.md
- Temel rules/
- Projeye uygun temel skills/

### Dosya güvenliği

- Workspace sınırı
- Ignore listesi
- Diff önizleme
- Kullanıcı onayı
- Snapshot
- Atomic write

### Model desteği

- Ollama
- En az bir OpenAI uyumlu endpoint
- Sağlayıcı testi
- Model seçimi
- Streaming
- Yapılandırılmış çıktı doğrulama

### Reviewer

- Temel belge tutarlılığı
- Eksik alan kontrolü
- Görev boyutu kontrolü
- MVP kapsam kontrolü

## 27.3 MVP’de olmaması gerekenler

- Kullanıcı hesabı
- Ödeme
- Cloud sync
- Takım çalışması
- Mobil companion
- Plugin marketplace
- Otomatik GitHub repository oluşturma
- Agent’ın kodu otomatik çalıştırması
- Otomatik commit ve push
- Gelişmiş mevcut repository analizi
- Çoklu agent paralel orkestrasyonu
- Kurumsal compliance modülleri

## 27.4 MVP test senaryoları

MVP aşağıdaki fikirleri makul şekilde planlayabilmelidir:

1. Basit Python dosya düzenleme scripti
2. Küçük tanıtım sitesi
3. CRUD tabanlı web uygulaması
4. Offline not mobil uygulaması
5. 2D oyun prototipi
6. AI destekli doküman analiz aracı
7. Web + mobil + backend içeren karma proje
8. Local-first masaüstü geliştirici aracı

---

# 28. Geliştirme Yol Haritası

## Faz 0 — Ürün doğrulama ve şema tasarımı

- 20–30 farklı proje fikri fixture’ı oluştur
- Evrensel proje şemasını tasarla
- Capability sözlüğünü oluştur
- Planlama seviyelerini tanımla
- Çıktı kalitesi kriterlerini belirle
- İlk promptları terminal prototipiyle test et

**Tamamlanma kriteri:** En az sekiz farklı proje biçiminde tutarlı JSON proje profili üretilebilmesi.

## Faz 1 — Yerel uygulama çekirdeği

- Tauri uygulama kurulumu
- React UI
- SQLite bağlantısı
- Proje oluşturma ve açma
- Workspace seçme
- Ayarlar
- Güvenli secret saklama
- Temel logging

**Tamamlanma kriteri:** Kullanıcı yerel proje oluşturup uygulamayı kapattıktan sonra yeniden açabilmeli.

## Faz 2 — Project State ve workflow

- Project state schema
- State revision
- Patch sistemi
- Workflow state machine
- Karar ve varsayım kayıtları
- Proje versiyonları

**Tamamlanma kriteri:** AI olmadan mock verilerle tam planlama akışı simüle edilebilmeli.

## Faz 3 — LLM provider katmanı

- Ollama adapter
- OpenAI compatible adapter
- Streaming
- Structured output
- Retry/timeout
- AI run log
- Token tahmini

**Tamamlanma kriteri:** Aynı use case iki farklı provider ile çalışabilmeli.

## Faz 4 — Evrensel keşif motoru

- Intent Analyzer
- Project Profiler
- Complexity Estimator
- Discovery Question Generator
- Requirement Analyst
- Scope Manager

**Tamamlanma kriteri:** Sekiz test projesinde kategori seçmeden uygun profil ve MVP oluşturabilmeli.

## Faz 5 — Teknik plan ve görevler

- Technology Evaluator
- Architecture Planner
- Task Decomposer
- Dependency graph
- Acceptance criteria generator
- Out-of-scope generator

**Tamamlanma kriteri:** Oluşturulan görevler bağımlılık sırasına konabilmeli ve reviewer’dan geçebilmeli.

## Faz 6 — Belge ve agent paketi

- Document Planner
- Markdown templates
- Rule Generator
- Skill Generator
- AGENTS.md
- MASTER_PROMPT
- Generic exporter

**Tamamlanma kriteri:** Seçilen klasörde kullanılabilir proje paketi oluşmalı.

## Faz 7 — Güvenli dosya yazma

- Ignore rules
- Workspace validation
- Diff
- Snapshot
- Atomic write
- Rollback

**Tamamlanma kriteri:** Kullanıcı onayı olmadan mevcut dosya değişmemeli; yapılan değişiklik geri alınabilmeli.

## Faz 8 — Reviewer ve sağlık skoru

- Consistency checks
- Missing field checks
- Scope checks
- Task quality checks
- Health score
- Onaylanabilir bulgular

**Tamamlanma kriteri:** Bilerek çelişkili fixture projelerinde sorunların büyük bölümü bulunabilmeli.

## Faz 9 — Uzman modüller

İlk uzman paketleri:

- Web
- Mobile
- Game
- Script/Automation
- AI

**Tamamlanma kriteri:** Her domain için en az iki test senaryosunda alan özel belgeler üretilebilmeli.

## Faz 10 — Mevcut proje analizi

- File inventory
- Technology detection
- Important-file selection
- Architecture extraction
- Gap analysis
- Improvement tasks

## Faz 11 — IDE ve Git entegrasyonları

- Cursor exporter
- Claude Code exporter
- Codex exporter
- Cline exporter
- Git diff
- Kullanıcı onaylı commit

## Faz 12 — Orkestrasyon

- Görev durumları
- Agent sonuçlarını içe aktarma
- Acceptance criteria doğrulama
- Test çıktısı analizi
- Plan sapması
- State güncelleme
- Sonraki görev önerisi

---

# 29. Test ve Değerlendirme Stratejisi

## 29.1 Geleneksel yazılım testleri

- Domain unit testleri
- Repository testleri
- State migration testleri
- Filesystem sandbox testleri
- Export golden tests
- UI component testleri
- E2E proje oluşturma akışları

## 29.2 AI çıktı testleri

Kesin metin eşleşmesi yerine kalite kriterleri kullanılmalıdır.

Örnek değerlendirmeler:

- Geçerli şemaya uyuyor mu?
- Kullanıcının ana amacını koruyor mu?
- Gereksiz kategori varsayımı yaptı mı?
- Kritik belirsizlikleri buldu mu?
- MVP’yi mantıklı daralttı mı?
- Teknoloji önerisini gerekçelendirdi mi?
- Görevler test edilebilir mi?
- Çelişki üretti mi?

## 29.3 Fixture veri seti

```text
simple-file-renamer
static-portfolio
saas-dashboard
offline-mobile-notes
2d-platformer
multiplayer-survival-game
local-rag-tool
enterprise-integration-platform
hybrid-mobile-web-ai-product
```

Her fixture için beklenen capability’ler ve kritik planlama ihtiyaçları elle tanımlanmalıdır.

## 29.4 Model karşılaştırması

Aynı fixture farklı modellerle çalıştırılabilir:

- Şema başarı oranı
- Toplam latency
- Token kullanımı
- Reviewer bulgu sayısı
- İnsan değerlendirme puanı
- Tutarlılık puanı

## 29.5 Prompt regression

Prompt değiştiğinde bütün fixture seti çalıştırılmalıdır. Önceki sürüme göre kalite kaybı raporlanmalıdır.

---

# 30. Başarı Ölçütleri

## 30.1 Ürün başarısı

- Kullanıcı kategori seçmeden proje başlatabiliyor.
- Sistem fikrin ana doğasını doğru çıkarıyor.
- Kullanıcı 15–30 dakikada uygulanabilir ilk plana ulaşabiliyor.
- Üretilen görevler IDE agent’ına ayrı ayrı verilebiliyor.
- Belgelerde kritik teknoloji çelişkileri bulunmuyor.
- Kullanıcı planın nedenlerini anlayabiliyor.
- Proje tekrar açıldığında kararlar kaybolmuyor.
- Dosya değişiklikleri güvenli biçimde yönetiliyor.

## 30.2 Kalite hedefleri

İlk hedef örnekleri:

```text
Structured output geçerliliği: ≥ %95
Kritik belge tutarsızlığı: proje başına < 1
Fixture capability recall: ≥ %85
Görevlerin test edilebilirlik puanı: ≥ 4/5
Kullanıcı onayı olmadan dosya değişikliği: 0
Workspace dışı dosya erişimi: 0
```

## 30.3 Kullanıcı deneyimi hedefleri

- İlk proje oluşturma sırasında teknik terim zorunluluğu olmaması
- AI’ın aynı soruyu tekrar etmemesi
- Bir turda en fazla 3–5 önemli soru
- Her öneride anlaşılır gerekçe
- Büyük değişikliklerde etki özeti
- Basit projelerde gereksiz belge üretmemesi

---

# 31. Riskler ve Önlemler

## 31.1 Her şeyi planlamaya çalışma riski

**Risk:** Sistem çok geniş olduğu için her domain’de yüzeysel kalabilir.

**Önlem:**

- Evrensel çekirdeği küçük tut
- Uzman modülleri kademeli ekle
- İlk aşamada sekiz referans senaryoda kaliteyi doğrula
- Kullanıcıya destek seviyesini dürüstçe göster

## 31.2 Hallucination ve yanlış teknik öneri

**Önlem:**

- Varsayımları işaretle
- Teknoloji kararlarında alternatif göster
- Reviewer kullan
- Güncel teknoloji bilgileri için gerektiğinde resmi kaynak doğrulaması yap
- Kesin olmayan bilgiyi karar olarak kaydetme

## 31.3 Bağlam büyümesi

**Önlem:**

- State slicing
- Belge özetleri
- Modül bazlı bağlam
- Token bütçesi
- Uzun sohbet yerine yapılandırılmış state

## 31.4 Belgelerin kullanıcının manuel değişikliklerini ezmesi

**Önlem:**

- Content hash
- Manuel düzenlenmiş işareti
- Bölüm bazlı merge
- Diff
- “Yeniden üret”, “koru”, “birleştir” seçenekleri

## 31.5 Gizli dosya sızıntısı

**Önlem:**

- Allowlist workspace
- Secret detection
- Ignore kuralları
- Gönderim önizlemesi
- Local-only mod
- Audit log

## 31.6 Aşırı karmaşık ilk sürüm

**Önlem:**

İlk MVP’nin odağını koru:

```text
Fikir
→ Proje profili
→ Keşif
→ MVP
→ Mimari
→ Görevler
→ Agent paketi
→ Güvenli export
```

## 31.7 Model sağlayıcı bağımlılığı

**Önlem:**

- Provider interface
- Prompt ve domain katmanını SDK’dan ayırma
- OpenAI uyumlu endpoint desteği
- Ollama desteği
- Model capability profili

---

# 32. Gelecekte Bulut Sürümüne Geçiş

## 32.1 Baştan ayrılması gereken arayüzler

```typescript
interface ProjectRepository {}
interface WorkspaceStorage {}
interface SecretStorage {}
interface LLMProvider {}
interface ExportTarget {}
interface SyncProvider {}
```

İlk implementasyonlar:

```text
SQLiteProjectRepository
LocalWorkspaceStorage
OSKeychainSecretStorage
LocalOrCloudLLMProvider
FilesystemExportTarget
```

Gelecekte:

```text
PostgresProjectRepository
CloudObjectStorage
TeamSyncProvider
GitHubExportTarget
```

## 32.2 Olası bulut özellikleri

- Kullanıcı hesabı
- Proje senkronizasyonu
- Takım üyeleri
- Rol ve izinler
- Paylaşılan kararlar
- Review yorumları
- Agent çalıştırma sunucuları
- Web dashboard
- Proje şablonu paylaşımı
- Kurum içi model endpoint’leri

## 32.3 Local-first ilkesini koruma

Bulut sürümü gelse bile:

- Yerel proje klasörü ana çalışma alanı olarak kalabilir.
- Kullanıcı hangi verinin senkronize olacağını seçebilir.
- Gizli kaynak kod yalnızca yerel kalabilir.
- Buluta yalnızca plan metadata’sı gönderilebilir.

---

# 33. Örnek Kullanım Senaryoları

## 33.1 Basit script

Kullanıcı:

> Bir klasördeki dosyaların adını tarih ve sıra numarasına göre değiştiren bir script istiyorum.

Sistem algısı:

```text
Interface: CLI veya tek çalıştırma
Capabilities: filesystem-access, batch-processing
Risk: Yanlış dosya adlandırma ve geri alma
Planning level: Quick
```

Sistem soruları:

- Alt klasörler dahil mi?
- Önizleme modu gerekli mi?
- Çakışan dosya adlarında ne yapılmalı?
- Geri alma manifesti oluşturulsun mu?

Üretilecek dosyalar:

```text
PROJECT.md
INPUT_OUTPUT_SPEC.md
SAFETY_RULES.md
TASKS.md
TEST_CASES.md
AGENTS.md
```

## 33.2 Web uygulaması

Kullanıcı:

> Serbest çalışanların müşterileriyle iş ve ödeme süreçlerini yönettiği bir uygulama.

Sistem algısı:

```text
Platforms: web
Capabilities:
- authentication
- project-management
- invoices
- payments
- file-sharing
Planning level: Standard veya Advanced
```

Uzman modüller:

- Product Requirements
- Web Architecture
- Authentication
- Payment Planner
- Security
- Database
- API
- UX Flows

## 33.3 Video oyunu

Kullanıcı:

> Oyuncunun küçük bir kasabada geceleri yaratıklardan korunup gündüzleri kasabayı geliştirdiği bir oyun.

Sistem algısı:

```text
Domain: game
Core loop:
- gündüz kaynak ve kasaba yönetimi
- gece savunma
Capabilities:
- time-cycle
- base-building
- combat
- progression
- save-system
Planning level: Advanced
```

Uzman modüller:

- Core Loop Designer
- Gameplay Systems
- Progression
- Enemy AI
- Level Design
- Save System
- Art Pipeline
- Performance Budget
- Playtest Planner

## 33.4 Karma proje

Kullanıcı:

> Telefon uygulamasından video çekip web panelinden düzenlediğim ve AI ile özet çıkardığım bir sistem.

Sistem parçaları:

```text
Mobil istemci
Web editörü
Backend API
Dosya yükleme
Video processing
AI summarization
Background jobs
Storage
Notifications
```

Sistem tek kategori seçmek yerine her alt sistem için ayrı görev ve skill üretir.

## 33.5 Aşırı karmaşık sistem

Kullanıcı:

> Farklı şirketlerin kendi AI agent ekiplerini tasarladığı, araç bağladığı ve iş akışlarını çalıştırdığı bir platform.

Sistem önce kapsamı daraltır:

```text
MVP:
- Tek organizasyon
- Sınırlı agent türleri
- Manuel workflow çalıştırma
- Üç temel araç entegrasyonu
- Run log
- Basit güvenlik sınırı

Not Now:
- Marketplace
- Çok bölgeli çalışma
- Otomatik ölçek
- Agent-to-agent açık protokol
- Kurumsal billing
```

Bu örnek sistemin yalnızca ek özellik üretmekle değil, kapsamı azaltmakla da görevli olduğunu gösterir.

---

# 34. İlk Uygulama Kararları

Aşağıdaki kararlar ilk geliştirme için önerilen başlangıç noktalarıdır.

## 34.1 Ürün

- Ürün local-first masaüstü uygulaması olacak.
- Kategori seçimi zorunlu olmayacak.
- Ana bilgi kaynağı yapılandırılmış project state olacak.
- Chat, state oluşturmak ve kararları tartışmak için kullanılacak.
- Basit ve karmaşık projeler adaptif derinlikle planlanacak.
- AI çıktıları kullanıcı onayından sonra state’e işlenecek.

## 34.2 Teknik

- Masaüstü: Tauri 2
- UI: React + TypeScript + Vite
- Yerel veri: SQLite + Drizzle
- Validation: Zod
- Yerel model: Ollama adapter
- Diğer modeller: OpenAI uyumlu adapter
- Dosya yazma: diff + snapshot + atomic write
- Export: önce Generic AGENTS.md formatı
- Test: Vitest + Playwright + Rust testleri

## 34.3 MVP sınırı

İlk sürüm şu akış tamamlanmadan yeni büyük özellik eklenmemelidir:

```text
Yeni proje
→ Doğal dil fikir girişi
→ Otomatik proje profili
→ Keşif soruları
→ MVP kapsamı
→ Teknik yaklaşım
→ Mimari
→ Görevler
→ AGENTS / rules / skills
→ Reviewer
→ Güvenli klasör exportu
```

## 34.4 İlk uzman alanlar

İlk test ve modül seti:

1. Script / automation
2. Web application
3. Mobile application
4. Desktop application
5. Video game
6. AI application
7. Backend service
8. Hybrid project

Bunlar kullanıcıya kategori olarak gösterilmek zorunda değildir. Sistemin iç kalite testleri ve uzman modül seçimi için kullanılacaktır.

---

# 35. Sonuç

Bu proje, yalnızca prompt yazan bir uygulama değil; kullanıcının yapmak istediği herhangi bir dijital projeyi anlayan ve kontrollü şekilde geliştirilebilir hâle getiren bir **AI proje mimarı** olacaktır.

Sistemin temel farkları:

- Kullanıcı kategori seçmek zorunda değildir.
- Tek bir proje türü yerine capability tabanlı profil çıkarır.
- Basit script ve büyük oyun için farklı planlama derinliği kullanır.
- Kararları, varsayımları, riskleri ve açık soruları saklar.
- Bir karar değiştiğinde etkilenen belgeleri ve görevleri bulur.
- Dinamik belge, kural ve skill paketleri oluşturur.
- Agent görevlerini küçük, doğrulanabilir ve kapsamı sınırlı üretir.
- Yerel dosyalarda güvenli diff ve snapshot sistemi kullanır.
- Yerel veya bulut LLM sağlayıcılarıyla çalışabilir.
- Zamanla mevcut proje reviewer ve agent orkestratörüne dönüşebilir.

Projenin ilk ve en önemli hedefi şudur:

> Kullanıcının doğal dilde anlattığı herhangi bir proje fikrini, kategori seçtirmeden; tutarlı bir proje state’ine, uygulanabilir bir mimariye, doğrulanabilir görevlere ve IDE agent’larının kullanabileceği güvenli bir proje paketine dönüştürmek.

---

## Teknoloji Doğrulama Notları

Bu plandaki başlangıç teknoloji kararları aşağıdaki resmî dokümantasyonların mevcut yetenekleri dikkate alınarak seçilmiştir:

- Tauri 2 resmî dokümantasyonu ve dosya sistemi/capability güvenlik yaklaşımı
- Vite resmî başlangıç ve React + TypeScript şablon dokümantasyonu
- SQLite resmî kullanım ve mimari dokümantasyonu
- Ollama resmî yerel API ve OpenAI uyumluluk dokümantasyonu

Bu seçimler kesin ve değiştirilemez kararlar değildir. Uygulama prototipi, performans testleri ve geliştirme deneyimi sonucunda yeniden değerlendirilebilir.
