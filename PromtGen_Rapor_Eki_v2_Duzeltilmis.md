# PromtGen — Rapor Eki (v2, düzeltilmiş): Migration, src-tauri ve Test Kapsamı

**Orijinal ek tarihi:** 2026-09-02
**Bu düzeltme:** 2026-09-03
**Repository:** WinierKingYT/promtgen
**Orijinalin incelediği snapshot:** `main / d3c05bd42fdeb62ff703e5667d255bd4b1f951a6`
**Bu düzeltmenin doğruladığı snapshot:** `fikir-asamasi-durustluk / 06d2541` — `d3c05bd`'nin **43 commit ilerisi**
**İlişki:** Bu belge, 2026-09-02 tarihli ana rapora ektir. Ana rapordaki 6. bölümden
(Idea→Plan doğrudan geçişini kaldırmak) hemen sonra okunması önerilir.

---

## Düzeltme günlüğü (orijinal eke göre neler değişti)

Orijinal ek `d3c05bd` snapshot'ında yazıldı; çekirdek bulgular (M.2 sessiz aşama
regresyonu, T.3 bağlanmamış agent katmanı, S.2 test boşluğu) **kod ve testlere
karşı tek tek doğrulandı ve geçerli**. Aşağıdaki maddeler yalnızca sayısal ve
konumsal hataları düzeltir:

| # | Orijinalde | Düzeltme | Doğrulama biçimi |
|---|---|---|---|
| 1 | "5 commit ileride" izlenimi | Çalışılan dal `d3c05bd`'nin **43 commit** ilerisinde (`git rev-list --count d3c05bd..HEAD`) | çalıştırıldı |
| 2 | `npm run test:v4` → **421 test, 79 suite, 35.8s** | Bu sayı `d3c05bd`'ye ait. HEAD'de **1329 test, 244 suite, 0 başarısız, ~6s** | `node scripts/run-v4-tests.mjs` çalıştırıldı (iki kez: 1327 → 1329) |
| 3 | `cargo test` → **7 test, 0 başarısız** | **Yanlış.** Statik sayım **19 `#[test]`** (10 `lib.rs` + 9 `execution.rs`), hiçbiri `#[ignore]`/feature-gate değil, `d3c05bd`'de de 19'du. Ayrıca **bu makinede `cargo` kurulu değil** (`cargo NOT on PATH`) — `cargo test` burada hiç çalıştırılamaz | `grep -c '#\[test\]'` + `which cargo` |
| 4 | `canonical-entities.js` | `d3c05bd`'den sonra **`canonical-entities.ts`** olarak yeniden adlandırıldı | `git ls-files` |
| 5 | `tauri-storage.js` | **`tauri-storage.ts`** | `git ls-files` |
| 6 | `LATEST_SCHEMA_REVISION = 6` | `d3c05bd`'de 6, HEAD'de **7** (`migrations.js:22`; `normalizeProjectDocument` → `next.schemaRevision = 7`) | dosya okundu |
| 7 | `currentStage()` @ `project-stages.ts:59-63` | HEAD'de **`:61-65`** (kod gövdesi birebir aynı) | dosya okundu |
| 8 | `normalizeProjectDocument()` @ `canonical-entities.js:453-495`; `stageApproval()` @ `:464` | HEAD'de `canonical-entities.ts:602` / `stageApproval` `:619-626` | dosya okundu |
| 9 | EP-09: `stageGate('handoff', project)` | İmza **`stageGate(project, target)`** (`project-stages.ts:82`) — argüman sırası ters yazılmış | dosya okundu |
| 10 | EP-08′ eylem tablosu: `migrationWarnings` `canonical-entities.js`'te kullanılıyor | `repairLegacyAcceptanceMetadata()` **`migrations.js:132-149`** içinde; `canonical-entities.ts` bu alana dokunmuyor | dosya okundu |
| 11 | `src/` 31.161 satır, `tests/` 15.279 satır, ~2:1 | 31.161 tam olarak `d3c05bd`'deki `src/` değeri. HEAD'de `src/` ≈ **40.396**, `tests/` ≈ **29.393**, oran ≈ **1,37:1** | `git ls-files | xargs wc -l` |
| 12 | "114 test dosyası" | `d3c05bd`'de 118, HEAD'de **164** | `git ls-files 'tests/**/*.test.*'` |
| 13 | M.3: tamamlanmış proje senaryosu | Güçlendirildi — bkz. aşağıda (`migrateLegacyToV5` `lifecycle.status='finalized'` set eder ama `currentStage` yine `'idea'` döner) | dosya okundu |
| 14 | T.3: "kimse henüz bağlamadı" | Doğrulandı **ve** repo kendi belgesiyle onaylıyor: `docs/architecture/MODULE_STATUS.md:32` `desktop-execution.js`'i "experimental / bağlı değil" işaretliyor | dosya okundu |

**Doğrulama notu (düzeltilmiş):** Bu ekteki bulgular repo klonlanarak, ilgili kaynak
dosyalar `06d2541` HEAD'inde okunarak ve **v4 test suite'i çalıştırılarak**
doğrulanmıştır (`node scripts/run-v4-tests.mjs` → **1329 test, 244 suite, 0
başarısız, ~6s**). **Rust tarafı çalıştırılamadı** (`cargo` bu makinede kurulu
değil); Rust iddiaları yalnızca statik okuma + `#[test]` sayımıyla doğrulanmıştır
(19 test). Statik okumaya dayanan tüm iddialar bu şekilde işaretlenmiştir.

---

## Bölüm M — Migration ve Geriye Dönük Uyumluluk

### M.1 — Veri şeması migration'ı: sağlam, endişe gerekmiyor

**Durum: DOĞRULANDI.**

`src/v4/migrations.js` içindeki `tryMigrateOrPassthrough()` (`migrations.js:95-114`),
herhangi bir eski `schemaVersion`/`schemaRevision` kombinasyonunu otomatik olarak
`LATEST_SCHEMA_VERSION = 5` / `LATEST_SCHEMA_REVISION = 7`'ye yükseltir
(`migrations.js:21-22`; orijinal ekte 6 yazıyordu — `d3c05bd`'de öyleydi, sonradan
7'ye çıktı).

`normalizeProjectDocument()` (`canonical-entities.ts:602`) her yüklemede eksik
alanları güvenli varsayılanlarla doldurur. Kod yorumu (`canonical-entities.ts:617-618`):

> "Ürün Modeli V3 aşama kapsayıcıları. Eklemeli: hiçbir eski alan silinmiyor,
> bu yüzden V3 öncesi belgeler yüklenirken bedava göç ediyor."

`tests/v4/v4-v5-migration.test.js` bu akışı gerçek verilerle (requirements,
tasks, testCases, exports, revisions) test eder ve legacy kayıtların
kaybolmadığını doğrular. **Bu kısım için P0 aksiyon gerekmiyor.**

### M.2 — Gerçek risk: "sessiz aşama regresyonu" (P0 bulgusu)

**Durum: DOĞRULANDI — kod ve test birebir eşleşiyor.**

`currentStage()` (`project-stages.ts:61-65`) aşamayı saklanan bir alandan değil,
onay durumundan hesaplar:

```ts
export function currentStage(project: ProjectDocumentV5): ProjectStage {
  if (project.ideaDesign?.approval?.status !== 'approved') return 'idea';
  if (project.solutionDesign?.approval?.status !== 'approved') return 'solution';
  return project.lifecycle?.status === 'finalized' ? 'handoff' : 'plan';
}
```

`normalizeProjectDocument()` içindeki `stageApproval()` yardımcı fonksiyonu
(`canonical-entities.ts:619-626`), eksik/tanınmayan durumları **her zaman
`'draft'`'a** düşürür — mevcut `objectives`, `requirements`, `tasks` alanlarına
bakmadan:

```ts
const stageApproval = (existing: Partial<StageApproval> | undefined): StageApproval => ({
    status: oneOf(existing?.status, STAGE_STATUSES) ? existing.status : 'draft',
    // ...
});
```

**Somut sonuç:** V2 akışıyla (`applyIdeaPlanConversion()`) zaten Idea→Plan
dönüşümünü tamamlamış, gereksinimleri ve görevleri olan bir kullanıcı projesi,
V3 devreye girdiği an `currentStage()` tarafından `'idea'` olarak
raporlanacaktır.

**Doğrulama (test çalıştırılarak — `tests/v4/application/project-stages.test.ts`,
`describe('V3 göç iskeleti')` @ `:124`):**

```ts
it('V3 oncesi belge asama kapsayicilarini kazanir', () => {
  const legacy = project() as unknown as Record<string, unknown>;
  delete legacy.ideaDesign;
  delete legacy.solutionDesign;
  const normalized = normalizeProjectDocument(legacy) as ProjectDocumentV5;
  assert.equal(normalized.ideaDesign.approval.status, 'draft');
  assert.equal(normalized.solutionDesign.approval.status, 'draft');
  assert.equal(normalized.schemaRevision, 7);
});
```

Yani bu bir gözden kaçmış kenar durum değil — bilinçli, test edilmiş bir tasarım
kararı. Hemen yanındaki test (`project-stages.test.ts:163-182`) gerekçeyi
açıklıyor:

```ts
it('eski kararlar SESSIZCE siniflandirilmaz, legacy-unclassified etiketlenir', () => {
  // ...
  // AI tahminiyle "bu fikir kararı" demek, kullanıcının hiç vermediği bir
  // kararı ona atfetmek olurdu.
  assert.equal(normalized.decisions[0].stage, 'legacy-unclassified');
});
```

### M.3 — Neden önemli (kişisel kullanım bağlamında bile)

- Var olan projelerde yanlışlıkla "Solution Design onayı bekliyor" gibi blokaj
  mesajları gösterebilir.
- `EP-03 — Stage Ownership`'in kabul kriteri olan *"Solution Approval olmadan
  plan finalize yok"* kuralı, zaten finalize edilmiş eski projeleri de
  retroaktif olarak kilitleyebilir.
- **Güçlendirilmiş nokta:** `migrateLegacyToV5()` eski `EXPORTED` fazındaki bir
  projeye `project.lifecycle.status = 'finalized'` atar (`migrations.js:48-49`).
  Ama `currentStage()` yine de `'idea'` döner, çünkü ilk kontrol
  `ideaDesign.approval.status !== 'approved'`. Yani **tamamlanmış ve dışa
  aktarılmış bir proje bile** V3'te "fikir aşaması"nda görünür — güven kaybı
  riski orijinal ektekinden daha somut.

### M.4 — Önerilen düzeltme: EP-08 → EP-08′ (düzeltilmiş)

İlk önerilen EP-08 ("var olan requirements/tasks'a bakarak ideaDesign'ı otomatik
approved say") codebase'in kendi tasarım felsefesiyle **çelişiyor** — proje
kasıtlı olarak AI'ın kullanıcı adına onay/karar çıkarımı yapmasını reddediyor
(bkz. M.2'deki `legacy-unclassified` testi; ayrıca `canonical-entities.ts:639-640`:
`framing.source` yalnızca `'confirmed'` ise kullanıcı kararı sayılır, aksi hâlde
`'inferred'`). Bu nedenle EP-08 iptal edilip yerine aşağıdaki öneri konuyor.

**EP-08′ — Geçiş Şeffaflığı (Migration Transparency), veri çıkarımı değil**

Amaç: Var olan projelerin V3 aşama modeline geçişte kullanıcıyı şaşırtmadan,
AI çıkarımı yapmadan bilgilendirmek.

Değiştirilecek:

- **Zaten var olan sinyali kullan:** `legacyPlanUnlocked()`
  (`project-stages.ts:133-140`) tam olarak "bu proje V2'de ilerlemiş miydi?"
  sorusunu yanıtlıyor:

  ```ts
  export function legacyPlanUnlocked(project: ProjectDocumentV5): boolean {
    return Boolean(
      project.sourceIdeaRevisionId
      || project.requirements?.length
      || project.decisions?.length
      || project.tasks?.length
    );
  }
  ```

  Migration bu fonksiyon `true` dönerken çalışıyorsa, kullanıcı bilgilendirilmeli.

- **Uyarı notunu var olan altyapıya yaz:** `migrations.js` içindeki
  `repairLegacyAcceptanceMetadata()` (`migrations.js:132-149`) zaten
  `project.metadata.migrationWarnings` dizisine yazıyor. `finalizeMigration()`
  (`migrations.js:116-130`) `repairLegacyAcceptanceMetadata()`'yi çağırdığı
  yerde, `legacyPlanUnlocked(project)` de kontrol edilip şu not eklenebilir:
  *"Bu proje V2 modelinde ilerlemişti; yeni onay adımlarını (Fikir Tasarımı,
  Teknik Çözüm Tasarımı) gözden geçirmeniz gerekiyor."*

- `ideaDesign.approval.status` **`'draft'` olarak kalmalı** — mevcut test
  (`project-stages.test.ts:125`) korunmalı, davranış değişmiyor.

- UI: proje "idea" aşamasında görünsün ama boş bir projeyle aynı görsel durumda
  olmamalı — örn. `metadata.migrationWarnings` doluysa "Gözden geçirme bekliyor"
  rozeti.

Doğrulama:

- Var olan `legacy-unclassified` deseniyle tutarlı yeni bir test: *"zaten
  `requirements`/`tasks` taşıyan bir proje migration sonrası
  `ideaDesign.approval.status === 'draft'` kalır AMA
  `metadata.migrationWarnings` bunu açıklayan bir not taşır."*

Kabul kriteri:

- Hiçbir var olan kullanıcı projesi, sessizce ve açıklamasız biçimde
  "yapılmamış" görünmemeli — ama sistem de kullanıcı adına onay uydurmamalı.

---

## Bölüm T — src-tauri (Masaüstü/Rust Katmanı)

### T.1 — Depo katmanı olgun ve güvenli

**Durum: DOĞRULANDI (statik okuma; `cargo test` bu makinede çalıştırılamadı).**

`src-tauri/src/lib.rs` (737 satır) + `execution.rs` (585 satır) — satır sayıları
birebir doğru:

- **SQLite üzerinde compare-and-swap (optimistic locking):**
  `save_project_in_connection()` (`lib.rs:336`) `document_revision`/
  `canonical_revision` eşleşmezse `revision_conflict()` üzerinden
  `PROJECT_REVISION_CONFLICT` döndürür (`lib.rs:325-334`).
- **Otomatik karantina:** bozuk/geçersiz JSON içeren kayıtlar `project_quarantine`
  tablosuna taşınır (`lib.rs:281`, `:388`, `:525`).
- **Yedek rotasyonu:** `MAX_PROJECT_BACKUPS: i64 = 20` (`lib.rs:15`, `:319`).
- **Birim testleri:** **19 adet** — `lib.rs` içinde 10 `#[test]`
  (`mod tests` @ `:565`), `execution.rs` içinde 9 `#[test]` (`mod tests` @ `:403`).
  Hiçbiri `#[ignore]` veya feature-gate değil. *(Orijinal ekteki "7 birim testi" /
  "`cargo test` → 7 test" yanlıştır.)*
- **Web↔Rust paralel doğrulama:** injection/secret regex kalıpları hem
  `context-isolation.ts` hem `lib.rs` içinde ayrı tanımlı; `execution.rs` içindeki
  imza kapısı testleri (`signature_gate`, `parse_authenticode_status`) bunu
  pekiştiriyor.

**Bu bölüm için P0/P1 aksiyon gerekmiyor.**

### T.2 — Migration entegrasyonu doğru bağlanmış

**Durum: DOĞRULANDI.**

`src/v4/tauri-storage.ts` içinde `TauriSqliteProjectRepository.list()`
(`tauri-storage.ts:222`) ve `.get()` (`:255`), her belge okunduğunda
`migrateStoredDocument()` → `tryMigrateOrPassthrough()` çağırır
(`tauri-storage.ts:436-439`) ve göç gerçekleştiyse anında `save()` ile geri yazar
(`:234-235`, `:262-263`). Masaüstü SQLite deposu, web/IndexedDB deposuyla aynı
migration disiplinine tabi — ayrı bir sessiz veri kaynağı riski yok. (M.2'deki
risk burada büyümüyor, küçülmüyor da — sorun migration'ın çalışması değil,
`currentStage()` hesaplama mantığı.)

### T.3 — P1 bulgusu: Agent Devri (Handoff) çalıştırma katmanı UI'a bağlı değil

**Durum: DOĞRULANDI — üstelik repo kendi belgesiyle onaylıyor.**

`execution.rs`, Codex CLI ile AI coding agent çalıştırmayı, git worktree
hazırlamayı, agent step'lerini (`planner`, `implementer`, `reviewer`, `verifier`
rolleri) yürütmeyi sağlayan tam işlevsel bir backend içeriyor
(`prepare_execution_worktree` @ `:346`, `run_codex_agent_step` @ `:363`).

Doğrulanan durum:

- `runCodexAgentStep()` ve `prepareExecutionWorktree()` (`src/v4/desktop-execution.js:8-9`
  — bu dosya hâlâ `.js`) `src/` altında **hiçbir yerden çağrılmıyor**
  (yalnızca kendi tanımları var).
- Tek test referansı `tests/v4/desktop-execution-settings.test.js`, o da yalnızca
  `selectCodexCli` / `clearCodexCli` fonksiyonlarını içe aktarıyor.
- `docs/architecture/MODULE_STATUS.md:32` `src/v4/desktop-execution.js` +
  `execution-orchestrator.js`'i **"experimental / Hayır (bağlı değil) / Labs ve
  açık kullanıcı talebiyle sınırlı"** olarak işaretliyor.

Yani "Agent Devri" (V3'ün son aşaması) iskelet + tam Rust implementasyonu
tamamlanmış, sadece UI'dan tetikleyen akış henüz yok.

**Bunun önemi:** Stage gate mantığını (onay olmadan agent çalıştırılamaz)
**şimdi, bağlanmadan önce** doğru yere koymak kritik.

**EP-09 — Agent Devri Bağlama**

Amaç: `execution.rs`'i UI'a bağlarken V3 stage gate'ini baştan doğru yere koymak.

Değiştirilecek: (henüz yazılmamış) Agent Devri paneli/bileşeni,
`desktop-execution.js` çağrılarından önce.

Doğrulama: `stageGate(project, 'handoff').open !== true` iken `runCodexAgentStep`
çağrılamamalı — bağlanma anında test olarak yazılmalı. *(İmza:
`stageGate(project: ProjectDocumentV5, target: ProjectStage)` —
`project-stages.ts:82`. Orijinal ekte argüman sırası ters yazılmıştı.)*

Not: `stageGate()` şu an yalnızca onay durumuna + `blockingConcerns()`'e bakıyor;
`'handoff'` hedefi için ayrı bir `case` yok — `target === 'solution'` sonrası
`return { open: true }` ile bitiyor. EP-09 kapsamında `stageGate`'e `handoff`
kolu da eklenmeli (`lifecycle.status === 'finalized'` veya Plan onayı şartı).

---

## Bölüm S — Test Kapsamı (Çalıştırılarak Doğrulandı)

### S.1 — Sayısal özet (HEAD `06d2541`)

```
node scripts/run-v4-tests.mjs → 1329 test, 244 suite, 0 başarısız, 0 atlanan (~6s)
cargo test                    → ÇALIŞTIRILAMADI (cargo bu makinede kurulu değil)
                                statik: 19 #[test] (lib.rs 10 + execution.rs 9)
```

*(Orijinal ekteki `421 test / 79 suite / 35.8s` değeri `d3c05bd` snapshot'ına
aittir; o commit'te `tests/v4` altında kabaca 388 `it()/test()` çağrısı vardı.)*

**Kod/test oranı:** `src/` ≈ 40.396 satır, `tests/` ≈ 29.393 satır → ≈ **1,37:1**
(git-izli `.ts/.tsx/.js/.jsx`/`.mjs`). `d3c05bd`'de `src/` = 31.161 (orijinal
ekteki rakam) ve oran ~2:1'di; suite büyüdükçe test tarafı da orantılı büyümüş.

**Test dosyası sayısı:** 164 (`d3c05bd`'de 118).

### S.2 — Idea→Plan gate: orijinalin iddiası ARTIK GEÇERSİZ (P0.3 zaten yapılmış)

**Durum: ÇÜRÜTÜLDÜ — `d3c05bd`'de doğruydu, `06d2541`'de değil.**

Orijinal ek `tests/v4/idea-plan-conversion.test.ts`'e bakıp "kimse Solution
Design engelini test etmemiş, çünkü henüz var olmayan bir davranış" demişti.
O dosyada hâlâ `solutionDesign` geçmiyor — ama davranış **başka yere taşınmış
ve test edilmiş**:

- `idea-plan-conversion-service.ts:31-38` → `conversionBlockers()` artık
  `...stageConversionBlockers(project)` ile başlıyor. Kod yorumu:
  *"Conversion V2: `Idea -> Plan` doğrudan geçişi kaldırıldı."*
- `previewIdeaPlanConversion` (`:100`) bu listeyi kullanıyor;
  `applyIdeaPlanConversion` (`:141-143`) `!canConvert` iken başarısız dönüyor;
  `Workspace.tsx:341-343` `result.reason`'ı kullanıcıya gösteriyor.
- Test: `tests/v4/application/conversion-v2.test.ts:105-122` —
  `it('teknik onay alinmadan plan uretilemez')` → blocker
  `/Teknik çözüm tasarımı onaylanmadan/`; `it('kapi gercek donusum
  onizlemesinde gorunur')` → `previewIdeaPlanConversion(...).canConvert === false`.
  Ayrıca `golden-path.test.ts:194` pozitif yolu (`solution` onaylı → engel yok).

Yani **ana raporun P0.3'ü, snapshot'tan sonraki 43 commit içinde uygulanmış ve
kapsanmış.** Bu ekin S.2 bölümü yalnızca eski snapshot için geçerli bir
gözlemdi; güncel dalda ek bir iş kalmıyor.

### S.3 — Genel değerlendirme

Test disiplini güçlü: kod tabanı kendi zayıf noktalarını (kullanıcı adına atıf
yapma, sessiz varsayım, onaysız karar üretme) test seviyesinde bilinçli olarak
koruma altına almış (bkz. M.2'deki `legacy-unclassified` deseni,
`canonical-entities.ts` içindeki `framing.source: 'inferred'` ayrımı). Orijinal
ekin "istisna" dediği Idea→Plan direct path da (S.2) güncel dalda kapatılmış
durumda — yani snapshot'tan bu yana boşluk da giderilmiş.

---

## Ana Rapora Eklenmesi Önerilen Yeni EP Paketleri

| Paket | Amaç | Durum |
|---|---|---|
| EP-08 (orijinal) | Otomatik onay çıkarımı | **İptal** — codebase felsefesiyle çelişiyor |
| EP-08′ | Geçiş şeffaflığı: `legacyPlanUnlocked()` sinyali + `metadata.migrationWarnings` notu + UI rozeti | **Uygulandı** — `f68f207` (veri) + `344ad9e` (UI) |
| EP-09 | Agent Devri'ni `stageGate(project, 'handoff')` ile bağlama; `stageGate`'e `handoff` kolu ekleme | **Uygulandı** — `509ebbb` (kapı + ray + testler). Gerçek panel bağlama net-new ürün işi, bu ekin kapsamı dışı. |
| P0.3 (ana rapor) | Idea→Plan doğrudan geçişini kaldır | **Zaten yapılmış** — `d3c05bd` sonrası; `conversion-v2.test.ts:105-122` kapsıyor (bkz. S.2) |

### Uygulama özeti (`fikir-asamasi-durustluk` dalı)

| Commit | Değişiklik |
|---|---|
| `f68f207` | `migrations.js` → `flagLegacyPlanProgress()`: `legacyPlanUnlocked()` true + onay `approved` değilken `metadata.migrationWarnings`'e not. Onay durumu değişmez. + `v4-v5-migration.test.js` pozitif/negatif. |
| `509ebbb` | `project-stages.ts` → `stageGate()`'e `handoff` kolu (`lifecycle.status === 'finalized'` şartı). Ray: DEVİR plan finalize edilene dek `locked` + neden. `project-stages.test.ts` + `workspace-stages.test.ts` + `golden-path.test.ts` güncel; `desktop-execution.js` yönlendirme yorumu. |
| `344ad9e` | `workspace-stages.ts` → `migrationReviewNotices()` selector (yalnız `currentStage === 'idea'` iken). `MigrationNotice.tsx` bileşeni (rail bu projelerde `railApplies=false` olduğu için ayrı banner, `PlanAlignmentNotice` stili). `Workspace.tsx` bağlama. `workspace-stages.test.ts` 4 test. |

Doğrulama (`06d2541` üzeri 3 commit): `node scripts/run-v4-tests.mjs` → **1358 test, 248 suite, 0 başarısız**; `tsc --noEmit` temiz; `eslint` 0 hata.

## Ana Rapora Eklenmesi Önerilen Dosya Bazlı Eylem Haritası Girdileri

| Dosya / Alan | Durum | Eylem |
|---|---|---|
| `src/v4/canonical-entities.ts` → `normalizeProjectDocument()` (`:602`), `stageApproval()` (`:619-626`) | Draft'a düşürme kasıtlı, uyarı yok | Davranışı değiştirme; not eklemeyi `migrations.js`'e bırak (EP-08′) |
| `src/v4/migrations.js` → `finalizeMigration()` (`:116-130`) + `repairLegacyAcceptanceMetadata()` (`:132-149`) | `migrationWarnings` altyapısı burada | `legacyPlanUnlocked(project)` true iken açıklayıcı `migrationWarnings` notu ekle (EP-08′) |
| `src/v4/application/project-stages.ts` → `legacyPlanUnlocked()` (`:133-140`) | "Proje ilerlemiş mi?" sinyali zaten var | EP-08′ uyarısını tetiklemek için kullan |
| `tests/v4/application/project-stages.test.ts` | Draft-düşürme davranışı zaten test edilmiş (`:125`) | Uyarı notu için yeni assertion ekle |
| `src/v4/application/project-stages.ts` → `stageGate()` (`:82-102`) | ~~`handoff` hedefi için ayrı kol yok~~ → **`handoff` kolu eklendi** (`509ebbb`) | — |
| `src-tauri/src/execution.rs` (`prepare_execution_worktree` `:346`, `run_codex_agent_step` `:363`) | Tam işlevsel, UI'a bağlı değil | Panel yazıldığında bağla; kapı hazır (`stageGate(project,'handoff')`) |
| `src/v4/desktop-execution.js` (hâlâ `.js`) | Production'da çağrılmıyor; EP-09 yönlendirme yorumu eklendi (`509ebbb`) | Panel bağlanırken kapıyı çağır |
| `src/v4/application/idea-plan-conversion-service.ts` → `conversionBlockers()` (`:31-52`) | **P0.3 zaten çözülü** — `stageConversionBlockers()` zincirlenmiş, `conversion-v2.test.ts` kapsıyor | — |
