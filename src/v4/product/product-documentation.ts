import { PRODUCT_CONTRACT, type SupportLevel } from './product-contract.js';
import { CAPABILITY_REGISTRY, evaluateStableEligibility } from '../capability-registry.js';
import { PROJECT_STAGES, STAGE_NAMES } from '../application/project-stages.js';
import { BOUNDARY_RULE, PRODUCTION_ROOTS, SOURCE_ROOT } from '../source-boundaries.js';

const title = (value: string) => `# ${value}\n\n`;
const bullets = (values: string[]) => values.map(value => `- ${value}`).join('\n');
const supportOrder: SupportLevel[] = ['stable', 'candidate-stable', 'beta', 'experimental', 'unsupported'];

const percentage = (value: number) => `${Math.round(value * 100)}%`;

function renderCapabilityEvidence(): string {
  const rows = CAPABILITY_REGISTRY.map(capability => {
    const eligibility = evaluateStableEligibility(capability);
    const automated = capability.evidence.map(item => `${item.level}: ${item.testId}`).join('<br>');
    const scenarios = capability.promotionEvidence.scenarios.completed
      ? `${capability.promotionEvidence.scenarios.passed}/${capability.promotionEvidence.scenarios.completed} (${percentage(eligibility.metrics.scenarioPassRate)})`
      : '0/0';
    const recovery = capability.promotionEvidence.recovery.documented
      ? capability.promotionEvidence.recovery.path
      : 'Belgelenmedi';
    // Statik belgede commit bağlamı yoktur; sürüm bağlamı engeli her satırda
    // aynı çıkar ve gerçek engelleri gizler. Bu sütun yalnız yeteneğin kendi
    // kanıtını raporlar, Stable ilanı değildir.
    return `| ${capability.publicName} | ${capability.maturity} | ${automated} | ${scenarios} | ${capability.promotionEvidence.users.participants} | ${recovery} | ${capability.promotionEvidence.lastVerifiedCommit || '—'} | ${eligibility.capabilityBlockers.length ? 'Bloklu' : 'Kanıt tam'} |`;
  }).join('\n');

  const blockers = CAPABILITY_REGISTRY
    .filter(capability => evaluateStableEligibility(capability).capabilityBlockers.length > 0)
    .map(capability => `### ${capability.publicName}\n\n${bullets(evaluateStableEligibility(capability).capabilityBlockers)}`)
    .join('\n\n');

  return `${title('Yetenek Kanıtları')}Bu belge doğrudan \`src/v4/capability-registry.ts\` kaynağından üretilir. Elle “stable” ilanı yapılamaz; her yetenek makinece denetlenen terfi kapısını geçmelidir. Statik belge geçmiş kanıt commit'ini gösterir; güncel commit eşleşmesi yalnız CI tarafından üretilen \`release-evidence.json\` ile doğrulanır.\n\nTerfi kapısı iki boyuttan oluşur. **Yetenek kanıtı** boyutu (test, senaryo, kullanıcı, kurtarma) bu belgede raporlanır. **Sürüm bağlamı** boyutu (kanıt commit'inin güncel build ile eşleşmesi) burada raporlanamaz, çünkü statik belge üretiminin commit bağlamı yoktur. Bu nedenle aşağıdaki tabloda “Kanıt tam” yazması **Stable ilanı değildir**: hiçbir yetenek CI dışında Stable'a terfi edemez.\n\n## Stable terfi kapısı\n\n- En az bir üretim entegrasyon, browser E2E veya native E2E kanıtı.\n- Desteklenen her platform için otomatik kanıt.\n- En az 5 benchmark senaryosu ve en az %90 başarı oranı.\n- Sıfır açık kritik kusur.\n- Belgelenmiş kurtarma veya geri alma yolu.\n- En az 5 gerçek kullanıcı katılımcısı.\n- Doğrulanan commit ile güncel build/CI commit'inin eşleşmesi. _(yalnız CI; bu belgede doğrulanmaz)_\n\n## Kanıt tablosu\n\nSon sütun yalnız yetenek kanıtı boyutunu gösterir; sürüm bağlamı boyutu dahil değildir.\n\n| Yetenek | İlan | Otomatik kanıt | Senaryo | Kullanıcı | Kurtarma | Son commit | Yetenek kanıt kapısı |\n|---|---|---|---|---:|---|---|---|\n${rows}\n\n## Açık terfi engelleri\n\nBunlar kanıt üretilerek kapatılabilen engellerdir. Hepsi kapansa bile Stable ilanı için CI'ın sürüm bağlamı doğrulaması gerekir.\n\n${blockers || 'Açık yetenek kanıtı engeli yok. Stable ilanı yine de CI sürüm bağlamı doğrulamasına bağlıdır.'}\n\n## Proje desteği özeti\n\n${supportOrder.map(level => `- **${level}:** ${PRODUCT_CONTRACT.supportedProjects.filter(item => item.support === level).length} proje türü`).join('\n')}\n\nBenchmark ve kullanıcı sayıları kaynaklarıyla kaydedilmeden sonuç başarısı iddia edilmez.\n`;
}

/** `Fikir Tasarımı (idea) → …` — sıra da adlar da tek kaynaktan gelir. */
const lifecycleLine = PROJECT_STAGES.map(stage => `${STAGE_NAMES[stage]} (\`${stage}\`)`).join(' → ');

const productionRootList = PRODUCTION_ROOTS.map(root => `\`${root}\``).join(' · ');

export function renderProductDocuments(): Record<string, string> {
  const supportedRows = PRODUCT_CONTRACT.supportedProjects
    .map(item => `| ${item.label} | ${item.support} | ${item.limitations.join(' ') || '—'} |`)
    .join('\n');

  const policies = (['candidate-stable', 'stable', 'beta', 'experimental'] as const).map(level => {
    const policy = PRODUCT_CONTRACT.maturityPolicies[level];
    return `## ${policy.label}\n\n${bullets(policy.requirements)}`;
  }).join('\n\n');

  return {
    'PRODUCT_VISION.md': `${title('PromtGen Ürün Vizyonu')}> ${PRODUCT_CONTRACT.positioning['tr-TR']}\n\n## Ana vaat\n\n${PRODUCT_CONTRACT.promise['tr-TR']}\n\n## Ürün odağı\n\nPromtGen’in ana ürünü Planner’dır. Labs özellikleri çekirdek planlama akışını destekler ancak ürünün ana vaadi olarak sunulmaz.\n`,
    'TARGET_USER.md': `${title('Hedef Kullanıcı')}## Birincil kullanıcı\n\n${PRODUCT_CONTRACT.primaryUser['tr-TR']}\n\n## Çözülen problemler\n\n${bullets(PRODUCT_CONTRACT.userProblems)}\n`,
    'PRODUCT_CONTRACT.md': `${title('Ürün Sözleşmesi')}Sözleşme kimliği: \`${PRODUCT_CONTRACT.id}\` · sürüm: \`${PRODUCT_CONTRACT.version}\`\n\n## Çekirdek navigasyon\n\n${bullets(PRODUCT_CONTRACT.coreNavigation)}\n\n## Kod üretimi sınırı\n\n${bullets(PRODUCT_CONTRACT.codePolicy)}\n\n## Labs\n\n${bullets(PRODUCT_CONTRACT.labsNavigation)}\n\n## Olgunluk kuralları\n\n${policies}\n`,
    // DOC-06 — belgenin adı da metni de sözleşmeden gelir.
    //
    // Eskiden burada `MVP_SCOPE.md` vardı: başlığı, "tek işi" cümlesi ve
    // akışın dördüncü adımı hiçbir sözleşme alanından türetilmiyor, doğrudan
    // bu satıra gömülü duruyordu. `check:product-docs` belgenin ÜRETİCİYLE
    // eşleştiğini doğrular; üreticinin SÖZLEŞMEYLE eşleştiğini hiç
    // doğrulamadı. Kapı yeşil kalırken belge bırakılan modeli ilan ediyordu
    // (envanter §3, DOC-06). Dosya adı da aynı iddianın parçasıydı.
    //
    // Şimdi her satırın sahibi var: tek iş `promise`, akış `PROJECT_STAGES`,
    // çıktılar `coreExports`. Kalan başlıklar yapısaldır — `PRODUCT_VISION.md`
    // ile `TARGET_USER.md` içindekiler gibi — ve hiçbir ürün modeli iddia
    // etmez.
    'CORE_SCOPE.md': `${title('Çekirdek Kapsam')}## PromtGen’in tek işi\n\n${PRODUCT_CONTRACT.promise['tr-TR']}\n\n## Çekirdek akış\n\n${lifecycleLine}\n\n## Çekirdek çıktılar\n\n${bullets(PRODUCT_CONTRACT.coreExports)}\n`,
    'SUPPORTED_PROJECTS.md': `${title('Desteklenen Projeler')}Bu tablo ürün sözleşmesinden üretilir. “Unsupported” alanlarda PromtGen uzmanlık veya üretime hazırlık iddiasında bulunmaz.\n\n| Proje türü | Destek | Sınırlamalar |\n|---|---|---|\n${supportedRows}\n`,
    'NON_GOALS.md': `${title('Kapsam Dışı Ürün Hedefleri')}${bullets(PRODUCT_CONTRACT.nonGoals)}\n\n## Kontrollü istisna\n\nKod üretimi ana ürün değildir. Yalnız kullanıcı açıkça isterse, onaylanmış TaskContract kapsamı içinde ve Labs üzerinden ikincil bir araç olarak kullanılabilir.\n`,
    'SUCCESS_METRICS.md': `${title('Başarı Metrikleri')}Bu hedefler yalnız ölçüm kanıtı bulunduğunda karşılanmış sayılır.\n\n${PRODUCT_CONTRACT.successMetrics.map(metric => `- **${metric.id}:** ${metric.target}${metric.evidenceRequired ? ' _(kanıt zorunlu)_' : ''}`).join('\n')}\n\n9/10 seviyesi karşılaştırmalı benchmark ve gerçek kullanıcı sonuçları olmadan ilan edilemez. 10/10 seviyesi bağımsız doğrulama ve çalışan bir alan paketi ekosistemi gerektirir.\n`,
    'CAPABILITY_EVIDENCE.md': renderCapabilityEvidence()
  };
}

/**
 * İki kök dosyanın paylaştığı gerçek bloğu.
 *
 * Buradaki her cümlenin bir sahibi var ve hiçbiri bu dosyada yazılmadı:
 * kimlik `PRODUCT_CONTRACT`, yaşam döngüsü `PROJECT_STAGES`, MVP kuralı
 * `PRODUCT_CONTRACT.mvpRule`, sınır ise `source-boundaries.ts`. DOC-06'nın
 * dersi tam olarak budur: eski `MVP_SCOPE.md` üretiliyordu ve kapı yeşildi, ama
 * metni üreticinin kaynağına gömülü olduğu için yasaklanan modeli ilan
 * edebiliyordu. Üretmek tek başına yetmez; sözleşmenin modeli veriyle
 * sahiplenmesi gerekir.
 */
function repoTruthBlock(): string {
  return `## PromtGen nedir

> ${PRODUCT_CONTRACT.positioning['tr-TR']}

Vaat: ${PRODUCT_CONTRACT.promise['tr-TR']}

## PromtGen ne DEĞİLDİR

${bullets(PRODUCT_CONTRACT.mistakenIdentities)}

## Canonical yaşam döngüsü

${lifecycleLine}

${PRODUCT_CONTRACT.mvpRule}

## Üretim ve uyumluluk

- Üretim gerçeği: ${productionRootList}
- Uyumluluk: \`${SOURCE_ROOT}/\` altındaki diğer her dizin.
- ${BOUNDARY_RULE}
`;
}

const generatedNotice = (fileName: string) => `<!-- ÜRETİLMİŞ DOSYA — elle düzenlemeyin.
     Kaynaklar: src/v4/product/product-contract.ts · src/v4/application/project-stages.ts · src/v4/source-boundaries.ts
     Üret: npm run product:docs · Denetle: npm run check:product-docs (${fileName} kapı kapsamındadır) -->`;

/**
 * Depo kökündeki iki ajan dosyası.
 *
 * **Neden üretiliyor.** Bu depoda elle yazılmış her ürün metni kaydı:
 * `README.md:3,5`, `docs/product/ROADMAP.md:3` ve
 * `docs/product/FEATURE_FREEZE.md:9` V3-09'a kadar terk edilmiş
 * `Fikir → MVP → Plan` modelini bugünün gerçeği gibi anlatıyordu; üçü de elle
 * düzeltildi ve bir daha kaymasınlar diye `scripts/lib/product-model-ratchet.ts`
 * belge cırcırına alındı. Sözleşmeden üretilen sekiz belgenin hiçbiri kaymadı.
 * Kök dosyalar deponun en yük taşıyan yeri olduğu için elle yazılmaları aynı
 * kaymayı en kötü yerde üretirdi.
 *
 * **İki dosya, iki iş.** `AGENTS.md` Codex geleneğidir ve depo gerçeğini
 * anlatır. `CLAUDE.md` ise kökte durduğu anda bu depodaki **her Claude Code
 * oturumunun canlı yönergesi** olur; bu yüzden gerçeğin yanına yalnız oturumun
 * bir şeyi kırmamak için gerçekten bilmesi gerekenler yazılır. İkisi de kısa
 * tutuldu: taranan bir metin duvarı kimseyi durdurmaz.
 *
 * Buradaki düzyazı yalnız komut adı ve dosya yolu söyler; ürün modeli hakkında
 * hiçbir iddiada bulunmaz.
 */
export function renderRepoRootDocuments(): Record<string, string> {
  return {
    'AGENTS.md': `${title('PromtGen — Ajan Yönergesi')}${generatedNotice('AGENTS.md')}

${repoTruthBlock()}
## Nereye bakılır

- \`docs/LEGACY_MODEL_INVENTORY.md\` — eski zihinsel model envanteri ve sınıflandırmalar.
- \`docs/TESHIS_HARITASI.md\` — ürünün ölçülmüş alan haritası.
- \`docs/product/\` — ürün sözleşmesinden üretilen belgeler.

Bu dosya onları tekrar etmez. Ürün modeline dair bir iddia yazmadan önce oradan okunur.

## Sınırı tutan kapılar

- \`npm run check:legacy-boundary\` — üretim/uyumluluk sınırı düzyazı değil, kapıdır.
- \`npm run check:product-docs\` — üretilen belgelerin kaynağıyla eşleşmesi; bu dosya da kapsamdadır.
`,
    'CLAUDE.md': `${title('PromtGen — Claude Code Oturum Yönergesi')}${generatedNotice('CLAUDE.md')}

Bu dosya bu depodaki her Claude Code oturumunun canlı yönergesidir.

${repoTruthBlock()}
## Oturum kuralları

- Ürün modeline dair bir cümle yazmadan önce kontrol belgelerini oku: \`docs/LEGACY_MODEL_INVENTORY.md\` (eski model envanteri) ve \`docs/TESHIS_HARITASI.md\` (ölçülmüş yüzey). Bu dosya onları tekrar etmez.
- Yeni ürün davranışı yalnız üretim köklerine yazılır; uyumluluk katmanına eklenen davranış \`npm run check:legacy-boundary\` kapısında düşer.
- Bu dosyayı ve \`AGENTS.md\`'yi elle düzenleme: \`npm run product:docs\` üretir, \`npm run check:product-docs\` denetler.
- \`npm run verify\` son adımda \`desktop:test\` ile cargo çalıştırır; Rust kurulu değilse orada durur. Öncesindeki kapılar koşmuş olur — kalanları elle tamamla.
- Ölçmeden iddia etme: bu depoda yorumlar ve düzyazı ölçüm yerine geçmez.
`
  };
}
