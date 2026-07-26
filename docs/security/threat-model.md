# PromtGen yerel-first tehdit modeli

## Kapsam ve varlıklar

Korunan varlıklar canonical proje belgesi, geçmiş revizyonlar, dosya envanteri, provider kimlik bilgileri, AI sağlayıcısına gönderilen filtrelenmiş bağlam ve masaüstü yürütme ayarlarıdır.

## Güven sınırları

```text
Kullanıcı dosyaları (güvenilmez)
  -> yerel envanter / secret / injection filtreleri
  -> allowlist structured facts
  -> context budget + redaction
  -> provider payload (yerel Ollama veya seçilmiş bulut sağlayıcısı)

React UI
  -> application command transaction
  -> ProjectRepository
  -> IndexedDB (web) / SQLite (desktop)
```

Dosya metni hiçbir zaman system veya user instruction rolüne dönüştürülmez. Provider’a yalnız dosya adı, türü, boyutu, satır sayısı, manifest/framework sinyalleri gibi sınırlandırılmış facts gönderilebilir.

## Başlıca saldırılar ve kontroller

| Saldırı | Kontrol | Kalan risk |
|---|---|---|
| Prompt injection içeren dosya | Türkçe/İngilizce heuristics, instruction/data ayrımı, şüpheli girdiyi dışlama | Semantik ve gizlenmiş varyasyonlar kaçabilir |
| API anahtarı sızıntısı | Hassas dosya politikası ve provider öncesi redaction | Regex bilinmeyen secret biçimlerini kaçırabilir |
| Bozuk IndexedDB kaydı | SHA-256 checkpoint, kalıcı karantina, yeni revision olarak restore | Tarayıcı profilinin tamamı silinirse yerel kurtarma yok |
| Path traversal | Göreli yol normalizasyonu, `..`, absolute ve gizli yol reddi | Platforma özgü yeni path biçimleri ayrıca test edilmelidir |
| XSS | React escaping, CSP, secret’ların session/OS vault sınırı | Mevcut inline style’lar nedeniyle CSP `style-src 'unsafe-inline'` içeriyor |
| Zararlı executable değişimi | Ad/path/version kontrolü | SHA-256 ve Authenticode güven kaydı henüz tamamlanmadı |
| Supply-chain açığı | Lockfile ve CI audit kapısı hedeflenir | Audit servisinin dependency metadata paylaşımı için açık kullanıcı onayı gerekir |

## Gizlilik sınıfları

- `local-only`: canonical belge, checkpoint, karantina ham kaydı, API anahtarı.
- `provider-eligible`: kabul edilmiş kararların özeti, kritik gereksinimler, açık sorular ve allowlist envanter facts.
- `never-send`: secret tespit edilen içerik, ham dosya metni, hidden/sensitive dosyalar, binary içerik, karantina kaydı.

## Kabul ilkeleri

Her provider çağrısı görev/schema/prompt sürümü, model, süre, retry, input hash ve fallback nedeni içeren provenance üretir. Kullanıcı onayı olmadan AI çıktısı canonical plana uygulanmaz.
