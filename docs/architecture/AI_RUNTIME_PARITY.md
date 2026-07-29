# AI Runtime Sahipliği ve Uyumluluk Kararı

Son inceleme: 2026-07-29

## Tek üretim yolu

AI destekli discovery, cevap alanı çıkarımı, Idea Lab ve etkilenen bölüm yenileme işlemleri şu zinciri kullanır:

`React hook/facade → typed application service → ai/runtime.ts → ai/registry.ts → task definition → ai/orchestrator.ts → provider-adapters.ts`

- `application/discovery-generation-service.ts` discovery, cevap çıkarımı ve konuşma turu transaction hazırlığının sahibidir.
- `application/idea-lab-generation-service.ts` Idea Lab provider/fallback seçimi ile proje projection güncellemesinin sahibidir.
- `registry.ts` görev kimliği, prompt sürümü, şema ve fallback politikasının kaynağıdır.
- `runtime.ts` sağlayıcı ayarlarını normalize eder, görev seçer ve adapter’ı oluşturur.
- `orchestrator.ts` timeout, tek repair denemesi, şema doğrulaması ve provenance üretir.
- `provider-adapters.ts` Ollama, OpenAI, Gemini ve NVIDIA protokol adaptörlerinin sahibidir.
- `ai/schemas/schemas.ts` bütün görev çıktı şemaları ile şema kimliklerinin tek tipli kaynağıdır.
- Task sonuçları kullanıcı onayı olmadan canonical planı değiştirmez.

## Compatibility sınırı

`src/v4/ai-context.js` artık implementasyon içermez. Eski test ve importlar için yalnız aşağıdaki üretim modüllerini yeniden dışa aktarır:

- `ai/context/planning-context.ts`
- `ai/context/context-builder.ts`
- `ai/provider-adapters.ts`

Yeni production servislerinin `ai-context.js`, `createProvider()` veya `runAITask()` çağırması mimari testle yasaktır. Servisler görev kimliğiyle `runRegisteredAITask()` çağırır.

`ai-discovery.js` compatibility facade'ı implementasyon içermez. Eski public API'yi
korumak için `application/idea-planning-api.ts` ve `ai/provider-connection.ts`
modüllerini yeniden dışa aktarır. React ve production benchmarkları bu facade'ı
import edemez.

Deterministik fikir genişletme, discovery fallback, Idea Lab yaklaşımı ve konsept
özeti politikalarının tek sahibi `application/deterministic-idea-planning.ts`
modülüdür. Aynı domain sınıflandırması bütün bu çıktılarda kullanılır.

## Korunan davranış

- Provider istek boyutu ve structured content sınırları korunur.
- Secret redaction provider payload’ından önce uygulanır.
- Provider URL/model normalizasyonu tek runtime yolunda uygulanır.
- Schema repair en fazla bir görev tanımının izin verdiği sayıda yapılır.
- Provenance; provider, model, prompt, şema, latency, retry ve input hash taşır.
- Provider hatasında ilgili application service açık `fallback` provenance üretir; kısmi canonical değişiklik yapılmaz.

## Kaldırma kapısı

`ai-context.js` ancak aşağıdakiler tamamlanınca silinebilir:

1. Legacy test importları doğrudan sahip modüllere taşınır.
2. Bir release boyunca production import grafiğinde compatibility kullanımı sıfır kalır.
3. Provider adapter contract testleri doğrudan yeni modülü hedefler.
4. ~~`ai-schemas.js` compatibility yüzeyi typed task schema modülüne taşınır.~~ Tamamlandı; dosya yalnız re-export yapar.

Her görev `outputFields` bildirir. Mimari kalite kapısı bu alanların strict Zod
şemasının üst seviye alanlarıyla ve promptta istenen JSON alanlarıyla birebir
eşleştiğini doğrular.
