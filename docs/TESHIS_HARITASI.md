# Teşhis Haritası

**Tarih:** 2026-09-03 · **Dal:** `main` · **Commit:** `8849f4b`
**Durum:** 18 kapı yeşil · test:v4 1382/1382 · test:all 23/23 · e2e 70/70

Bu belge bir yol haritası **değildir**. Yol haritası yazmadan önce ürünün
yüzeyini ölçen bir teşhistir. Aşağıdaki her satır çalıştırılarak ya da
kaynaktan sayılarak elde edildi; hiçbiri tahmin değil.

Neden ayrı bir belge: sıralama yapmadan önce "ölçüldü" ile "ölçülmedi"yi
ayırmak gerekiyordu. Ölçülmemiş alanlar arasında öncelik sıralaması yapmak
tahmin olur.

---

## 1. Ana bulgu — ana vaadin son vuruşu arayüzden erişilemiyor

Ürünün kendi vaadi (`PRODUCT_CONTRACT.promise`, `docs/product/PRODUCT_VISION.md`)
üç vuruş:

> "Fikrini anlat; birlikte netleştirelim ve onayla. Sonra nasıl kuracağımızı
> tasarlayıp onayla. **Planını kodlama aracına dışa aktar.**"

`src/v4/exporter.ts` bu son vuruş için zengin bir aile sunuyor:

| Fonksiyon | Ne üretir | React'ten çağrı |
|---|---|---:|
| `exportCanonicalMarkdown` | tek düz `.md` | **1** |
| `createDocumentSet` | 18 belgelik set | 0 |
| `buildAgentPrompt` | ajan devir istemi | 0 |
| `createIdeWorkspaceFiles` | IDE çalışma dosyaları | 0 |
| `createIdeWorkspacePackage` | IDE çalışma paketi | 0 |
| `createPromtgenPackage` | taşınabilir `.promtgen` | 0 |
| `createExportBundle` | dışa aktarım paketi | 0 |
| `IDE_ADAPTERS` | generic / codex / cursor / claude | 0 |

Arayüzdeki tek dışa aktarım düğmesi (`Workspace.tsx:361`) `exportCanonicalMarkdown`
çağırıp `${project.identity.name}.md` indiriyor.

**Uygulama bir `.promtgen` paketini içe aktarabiliyor ama üretemiyor.**
`StartScreen.tsx:115` yalnız `inspectPromtgenPackage` çağırıyor. Paket üretimi
sadece testlerde koşuyor (`tests/v4/acceptance-flow.test.js`,
`tests/e2e/smoke.spec.ts`).

### Doğrulama

```bash
for fn in createPromtgenPackage createIdeWorkspacePackage createIdeWorkspaceFiles \
          createDocumentSet buildAgentPrompt createExportBundle IDE_ADAPTERS; do
  echo "$fn : $(grep -rn "$fn" src/react/ | wc -l)"
done
grep -rn "exporter" src/react/
```

---

## 2. Aşama modeli — dört aşama ilan ediliyor, ikisinin paneli var

`PROJECT_STAGES = ['idea', 'solution', 'plan', 'handoff']`
(`src/v4/application/project-stages.ts:20`)

Ray dördünü de gösteriyor (`StageRail.tsx`: `FİKİR · ÇÖZÜM · PLAN · DEVİR`) ve
DEVİR'in yazılı bir vaadi var (`workspace-stages.ts:59`):

> "Kodlama aracına devredilecek paketi hazırlıyoruz."

Ancak:

- `handoff` motorda **yalnız 3 dosyada** geçiyor: `project-stages.ts`,
  `workspace-stages.ts`, `contracts.ts` — üçü de sadece aşama tanımı/etiketi.
- `handoff` React tarafında **hiçbir dosyada** geçmiyor.
- `Workspace.tsx` yalnız iki aşama paneli render ediyor: `solution` ve `idea`.
- Görünümler: `develop`, `guide`, `plan`. **`handoff` görünümü yok.**

Devir işini yapan kod var — `canonical-export`, görev sözleşmeleri, uygulama
kanıtı adı altında — ama aşamaya bağlanmamış.

---

## 3. İkinci bulgu — sözleşme ile gerçek çıktı arasında kapı yok

`PRODUCT_CONTRACT.coreExports` (`src/v4/product/product-contract.ts:80`) çıktıları
adıyla beyan ediyor:

```
PROJECT_BRIEF.md, REQUIREMENTS.md, DECISIONS.md, TASKS.md, AGENTS.md, project.promtgen
```

`canonical-document-export.ts` ise şunları üretiyor:

```
documents/prd.md            documents/requirements.md    documents/decisions.md
documents/tasks.md          documents/architecture.md    documents/risks.md
documents/security.md       documents/test-strategy.md   documents/traceability.md
documents/modules.md        documents/operations.md      documents/deployment.md
documents/research.md       documents/review.md          plan/master-plan.md
idea/idea-foundation.md     agents/runbook.md            agents/execution-history.md
```

`check:product-docs` yalnız **belgelerin sözleşmeye uyduğunu** denetliyor
(8 belge `renderProductDocuments()` ile üretiliyor). **Sözleşmenin koda uyduğunu
denetleyen hiçbir şey yok.**

Bu, bu projenin tam da önemsediği sınıftan bir boşluk: iddia ile gerçek
arasında kapı yok.

---

## 4. Alan haritası

| Alan | Boyut | Durum | Dayanak |
|---|---|---|---|
| Fikir aşaması | panel · pano · koç | **ölçüldü** | Uydurma alan, kota, çift kart, ton, dil, köken kapatıldı |
| Çözüm aşaması | 255 satır panel | **ölçülmedi** | Hiç sistematik koşturulmadı |
| Plan aşaması | görünüm + motor | **yarı** | Motor benchmark 10/10; arayüzü elle denenmedi |
| Devir aşaması | — | **boş** | Motorda 3 dosyada tanım; React'te 0 |
| Dışa aktarım | 8 genel fonksiyon | **1/8 bağlı** | Bkz. §1 |
| Oyun paketi | 394 satır | **koşturulmadı** | `benchmarks/domain-packs/` → yalnız web-saas, backend-api |
| Web / Backend paketi | 359 + 362 satır | **ölçüldü** | Benchmark senaryo setleri var |
| Arayüz | 38 dosya · 4821 satır | **yarı** | Tema yenilendi, görsel sözleşme kilitli; akış denenmedi |
| Yayın makinesi | ~1600 satır | **çalışıyor** | Kararla korunuyor, bkz. §6 |

---

## 5. Açık çalışma başlıkları

**Kasten sırasız.** Sıralamayı §7'deki teşhis turu belirleyecek.

### A — Devri arayüze bağlamak
Motorda hazır olan paket üretimini, IDE adaptörlerini ve ajan istemini
kullanıcının erişebileceği hâle getirmek. Ana vaadin tamamlanması bu.
_Dayanak:_ §1 tablosu — 8 fonksiyondan 7'si 0 çağrı.

### B — Sözleşme ile çıktı arasına kapı koymak
_Dayanak:_ §3.

### C — Çözüm aşamasını ölçmek
Dört aşamanın ortasındaki halka hiç sınanmadı; fikirden plana giden yol
buradan geçiyor.

### D — Oyun paketini koşturmak
Paket zayıf değil — çekirdek döngü, kare bütçesi, girdi gecikmesi, ağ yetkisi
ve hile yüzeyini soruyor (`src/v4/domain-packs/game.ts`). Sadece hiç denenmemiş.

### E — Test dosyalarını tip denetimine almak
`src` ayarlarıyla **208** hata, 92'si `canonical-entities-characterization.test.ts`
içinde, ilk beş dosyada 158'i. `tsconfig.tests.json` ile 1201 hata çıkıyor ama
%79'u yalnız iki ekstra bayraktan (`noPropertyAccessFromIndexSignature` 428,
`noUncheckedIndexedAccess` 525) — 1201 rakamı testleri denetlemenin maliyeti
olarak gösterilmemeli. 21 hata "fikstür gerçek tipi taşımıyor" sınıfından.

### F — Fikir birleştirme
İki ayrı zamanda geliştirilmiş fikri kayıpsız birleştirmek. Birleştirilecek
gerçek proje oluştuğunda anlam kazanır. Zemin hazır: `foundationGrounding`
köken kaydı kuruldu.

---

## 6. Verilen karar — yayın makinesi kalıyor

Karşılaştırma çalışması, anonim oturum içe aktarımı, yetenek kayıt defteri ve
yayın kapısı (~1600 satır) **korunuyor**. Proje ileride gerçek bir ürüne
dönüşürse yayınlanabilir; o gün bu altyapıyı yeniden kurmak pahalı olur.

Yan faydası: yetenek kayıt defteri, ürünün "bunu ölçmedim, iddia etmiyorum"
diyebilmesini sağlayan mekanizma. Kendi aracının kullanıcısına yalan
söylememesi yayından bağımsız olarak değerli.

Not: 14 yetenekten 13'ünün tek engeli "en az 5 kullanıcıdan kanıt". Bu bir
yayın kapısıdır; kişisel kullanım hedefiyle ilgisizdir ve yazarın kendini
katılımcı sayarak geçmesi kapının varlık sebebine aykırıdır.

---

## 7. Sıralamayı ölçüm belirlesin

§5'teki başlıkları şimdi sıralamak tahmin olur; C, D ve arayüz akışı hakkında
hâlâ "ölçülmedi" yazıyor. Sıralamayı kesinleştirmenin yolu:

1. Üç farklı fikir — biri oyun, biri araç, biri kasten belirsiz — dört aşamanın
   tamamından canlı modele karşı geçirilir.
2. Her aşama sınırında çıktı kaydedilir: uyduruyor mu, boş mu, çelişiyor mu,
   gereksiz soru mu soruyor, aynı şeyi iki kez mi yazdırıyor.
3. Çıkan **alan × kusur** matrisi sıralamayı yazar.

**Ölçülemeyen tek şey:** "Bu bana yarar mı?" Mekanik kusuru tur bulur; faydayı
yalnız kullanıcı söyleyebilir. Bu yüzden turun sonunda çıktılar kullanıcıya
sunulur.

---

## Yöntem notu

Bu oturumda kod okuyarak kurulan altı kusur şüphesinin altısı da çürüdü;
gerçek kusurların hepsi çalıştırmaktan çıktı. Bu belgedeki bulgular da
okumayla değil, sayarak ve çalıştırarak elde edildi. Bir sonraki adımın
tur olmasının sebebi budur.
