# AI Sağlayıcı Entegrasyonu — Kurtarma ve Geri Alma

Bu belge `ai-discovery-provider` yeteneğinin terfi kapısındaki kurtarma koşulunu karşılar.
Genel sürüm geri alma akışı için [rollback.md](rollback.md) belgesine bakın; burada yalnız
sağlayıcı entegrasyonunun ürettiği sorunlar ele alınır.

## Kapsanan başarısızlıklar

| # | Senaryo | Belirti |
|---|---|---|
| 1 | Kimlik bilgisi ele geçirildi | Sağlayıcı panelinde tanınmayan kullanım veya fatura artışı |
| 2 | Sessiz fallback | Plan AI ile üretildi sanılıyor ama kaynak yerel kural motoru |
| 3 | Sağlayıcı bozuk içerik üretti ve canonical'a girdi | Onaylanan öneri planı tutarsız hâle getirdi |
| 4 | Sağlayıcı erişilemez | Bağlantı testi sürekli başarısız; öneriler hep yerel |
| 5 | Yanlış model veya sağlayıcı seçimi | Beklenmeyen maliyet ya da düşük kalite |

## Kimlik bilgisinin durduğu yerler

| Ortam | Depolama | Kalıcılık |
|---|---|---|
| Web | `SessionCredentialVault` — süreç içi `Map` ([credential-vault.js:3](../../src/v4/credential-vault.js:3)) | Sekme kapanınca kaybolur; diske **hiç** yazılmaz |
| Masaüstü | OS anahtar zinciri, `keyring::Entry::new("PromtGen", provider)` ([lib.rs:306](../../src-tauri/src/lib.rs:306)) | Windows Credential Manager / macOS Keychain / Secret Service |

Kimlik bilgisi canonical belgeye, checkpoint'e veya export paketine **yazılmaz**. İstek
sırasında yalnız HTTP başlığında taşınır — OpenAI/NVIDIA için `Authorization: Bearer`,
Gemini için `x-goog-api-key`. Bu sınır
[provider-integration-benchmark.ts](../../scripts/provider-integration-benchmark.ts)
`credential-isolation` senaryosuyla her `verify` çalışmasında doğrulanır.

## Kurtarma adımları

### Senaryo 1 — Kimlik bilgisi ele geçirildi

1. **Önce sağlayıcıda iptal edin.** Anahtarı PromtGen'den silmek sağlayıcı tarafında
   geçersiz kılmaz. OpenAI/Gemini/NVIDIA panelinden anahtarı revoke edin.
2. PromtGen'de sağlayıcı ayarlarından kimlik bilgisini kaldırın. Masaüstünde bu
   `delete_provider_credential` ile anahtar zincirinden siler
   ([lib.rs:318](../../src-tauri/src/lib.rs:318)); web'de sekmeyi kapatmak da yeterlidir.
3. Ne gönderildiğini belirleyin. Sağlayıcıya giden istekler plan bağlamını taşır: proje
   fikri, gereksinimler ve envanter *metadata*'sı. Dosya içeriği ve sırlar taşınmaz.
   Etkilenen projelerin `metadata.provenance` kayıtlarından `requestedAt` damgalarına
   bakarak hangi çağrıların yapıldığını çıkarabilirsiniz.
4. Yeni anahtar üretip girin ve bağlantı testini çalıştırın.

Ollama kullanılıyorsa kimlik bilgisi yoktur; adres loopback ile sınırlıdır ve bu senaryo
uygulanmaz.

### Senaryo 2 — Sessiz fallback

Fallback sessiz **değildir**; sözleşme her zaman iz bırakır:

- Öneri paketinde `source.type === 'local'` ve `source.fallbackReason` dolu olur
  ([deterministic-idea-planning.ts:174](../../src/v4/application/deterministic-idea-planning.ts:174)).
- Başarılı AI çağrısında `source.type === 'ai'` ve provenance'ta `fallbackReason: null` olur.
- Öneri kartındaki kaynak ve fallback etiketi kalıcıdır.

Etiket görünmüyorsa bu bir **hata**dır, kullanım sorunu değildir. Bu durumda:

1. Etkilenen revizyonu not edin ve öneriyi onaylamayı durdurun.
2. `benchmark:provider-integration` çalıştırın; `schema-failure-fallback` ve
   `transport-failure-fallback` senaryoları etiketleme sözleşmesini doğrular.
3. Senaryolar geçiyor ama UI etiketi göstermiyorsa sorun sunum katmanındadır; geçen
   benchmark bunu yakalamaz ve yeni bir E2E kontrolü gerekir.

### Senaryo 3 — Bozuk içerik canonical'a girdi

AI önerisi kullanıcı onayı olmadan canonical planı değiştiremez. Onaylandıysa değişiklik
normal bir revision'dır:

1. Etkilenen revizyondan önceki son sağlam checkpoint'i seçin.
2. Yeni revision olarak restore edin (rollback.md adım 4). Eski revizyon silinmez.
3. Öneriyi üreten provenance kaydını (`providerId`, `model`, `promptVersion`, `inputHash`)
   olay kaydına yazın; aynı model ve prompt sürümü tekrar aynı sonucu üretebilir.

### Senaryo 4 — Sağlayıcı erişilemez

Bağlantı testi kullanıcının düzeltebileceği ayrı hata kodları döndürür
([provider-connection.ts:30](../../src/v4/ai/provider-connection.ts:30)):

| errorCode | Anlamı | Yapılacak |
|---|---|---|
| `configuration` | Adres politikayı ihlal ediyor | Ollama adresini loopback'e alın |
| `authentication` | 401/403 | Anahtarı yenileyin |
| `endpoint` | 404 | Model adını ve adresi doğrulayın |
| `rate_limit` | 429 | Bekleyin veya kotayı artırın |
| `provider` | 5xx | Sağlayıcı geçici olarak kullanılamıyor |
| `network` | Ağ/CORS | Bağlantıyı ve güvenlik duvarını kontrol edin |
| `timeout` | 10 sn aşıldı | Yerel modelde donanım sınırı olabilir |

Sağlayıcı kalıcı olarak erişilemezse ürün çalışmaya devam eder: `offline` moda geçin.
`offline-local-first` benchmark senaryosu bu modda **hiç ağ isteği yapılmadığını**
doğrular. Planlama yerel kural motoruyla sürer.

### Senaryo 5 — Yanlış model veya sağlayıcı

Sağlayıcı ve model ayarı canonical plana ait değildir; değiştirmek geçmiş revizyonları
etkilemez. Ayarı düzeltip yeni öneri üretmek yeterlidir. Önceki önerilerin provenance
kaydı hangi modelle üretildiğini korur.

## Geri alınamayanlar

Sağlayıcıya gönderilmiş bir istek geri çağrılamaz. Bulut sağlayıcısı, kendi saklama
politikasına göre veriyi tutar. Bu nedenle:

- Hassas proje verisiyle çalışırken `offline` veya `ollama` tercih edin; ikisi de cihaz
  dışına veri çıkarmaz.
- Bulut sağlayıcı kullanılacaksa sağlayıcının saklama ve eğitim politikasını önce okuyun.
- Bir olayda "veri sağlayıcıya gitti mi" sorusunun cevabını provenance kayıtları verir;
  bu kayıtları silmeyin.

## Doğrulama

```bash
npm run benchmark:provider-integration
```

Ek olarak sağlayıcı bağlantı testini her yapılandırılmış sağlayıcı için çalıştırın ve
`offline` modda plan üretiminin çalıştığını doğrulayın. Olay kaydına sürüm, commit SHA,
etkilenen sağlayıcı, anahtarın revoke edildiği zaman ve etkilenen proje sayısını yazın.
