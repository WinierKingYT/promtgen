import { PRODUCT_CONTRACT, type SupportLevel } from './product-contract.js';
import { CAPABILITY_REGISTRY, evaluateStableEligibility } from '../capability-registry.js';

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
    return `| ${capability.publicName} | ${capability.maturity} | ${automated} | ${scenarios} | ${capability.promotionEvidence.users.participants} | ${recovery} | ${capability.promotionEvidence.lastVerifiedCommit || '—'} | ${eligibility.eligible ? 'Geçti' : 'Bloklu'} |`;
  }).join('\n');

  const blockers = CAPABILITY_REGISTRY
    .filter(capability => !evaluateStableEligibility(capability).eligible)
    .map(capability => `### ${capability.publicName}\n\n${bullets(evaluateStableEligibility(capability).blockers)}`)
    .join('\n\n');

  return `${title('Yetenek Kanıtları')}Bu belge doğrudan \`src/v4/capability-registry.ts\` kaynağından üretilir. Elle “stable” ilanı yapılamaz; her yetenek makinece denetlenen terfi kapısını geçmelidir.\n\n## Stable terfi kapısı\n\n- En az bir üretim entegrasyon, browser E2E veya native E2E kanıtı.\n- Desteklenen her platform için otomatik kanıt.\n- En az 5 benchmark senaryosu ve en az %90 başarı oranı.\n- Sıfır açık kritik kusur.\n- Belgelenmiş kurtarma veya geri alma yolu.\n- En az 5 gerçek kullanıcı katılımcısı.\n- Son doğrulanan commit kaydı.\n\n## Kanıt tablosu\n\n| Yetenek | İlan | Otomatik kanıt | Senaryo | Kullanıcı | Kurtarma | Son commit | Stable kapısı |\n|---|---|---|---|---:|---|---|---|\n${rows}\n\n## Açık terfi engelleri\n\n${blockers || 'Açık engel yok.'}\n\n## Proje desteği özeti\n\n${supportOrder.map(level => `- **${level}:** ${PRODUCT_CONTRACT.supportedProjects.filter(item => item.support === level).length} proje türü`).join('\n')}\n\nBenchmark ve kullanıcı sayıları kaynaklarıyla kaydedilmeden sonuç başarısı iddia edilmez.\n`;
}

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
    'PRODUCT_CONTRACT.md': `${title('Ürün Sözleşmesi')}Sözleşme kimliği: \`${PRODUCT_CONTRACT.id}\` · sürüm: \`${PRODUCT_CONTRACT.version}\`\n\n## Çekirdek navigasyon\n\n${bullets(PRODUCT_CONTRACT.coreNavigation)}\n\n## Labs\n\n${bullets(PRODUCT_CONTRACT.labsNavigation)}\n\n## Olgunluk kuralları\n\n${policies}\n`,
    'MVP_SCOPE.md': `${title('MVP Kapsamı')}## MVP’nin tek işi\n\nBir proje fikrini kullanıcı onaylı, izlenebilir ve AI kodlama aracına uygulanabilir bir proje planına dönüştürmek.\n\n## Çekirdek çıktılar\n\n${bullets(PRODUCT_CONTRACT.coreExports)}\n\n## Çekirdek akış\n\n1. Fikri anlat.\n2. Sistem yorumunu düzelt veya onayla.\n3. Hedef kullanıcıyı, problemi ve ana sonucu kesinleştir.\n4. MVP içi ve kapsam dışı alanları onayla.\n5. Gereksinimleri, kararları, riskleri ve görevleri onayla.\n6. Tutarlılık kapısını geç ve proje paketini dışa aktar.\n`,
    'SUPPORTED_PROJECTS.md': `${title('Desteklenen Projeler')}Bu tablo ürün sözleşmesinden üretilir. “Unsupported” alanlarda PromtGen uzmanlık veya üretime hazırlık iddiasında bulunmaz.\n\n| Proje türü | Destek | Sınırlamalar |\n|---|---|---|\n${supportedRows}\n`,
    'NON_GOALS.md': `${title('Kapsam Dışı Ürün Hedefleri')}${bullets(PRODUCT_CONTRACT.nonGoals)}\n`,
    'SUCCESS_METRICS.md': `${title('Başarı Metrikleri')}Bu hedefler yalnız ölçüm kanıtı bulunduğunda karşılanmış sayılır.\n\n${PRODUCT_CONTRACT.successMetrics.map(metric => `- **${metric.id}:** ${metric.target}${metric.evidenceRequired ? ' _(kanıt zorunlu)_' : ''}`).join('\n')}\n\n9/10 seviyesi karşılaştırmalı benchmark ve gerçek kullanıcı sonuçları olmadan ilan edilemez. 10/10 seviyesi bağımsız doğrulama ve çalışan bir alan paketi ekosistemi gerektirir.\n`,
    'CAPABILITY_EVIDENCE.md': renderCapabilityEvidence()
  };
}
