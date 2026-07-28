import { PRODUCT_CONTRACT, type SupportLevel } from './product-contract.js';

const title = (value: string) => `# ${value}\n\n`;
const bullets = (values: string[]) => values.map(value => `- ${value}`).join('\n');
const supportOrder: SupportLevel[] = ['stable', 'beta', 'experimental', 'unsupported'];

export function renderProductDocuments(): Record<string, string> {
  const supportedRows = PRODUCT_CONTRACT.supportedProjects
    .map(item => `| ${item.label} | ${item.support} | ${item.limitations.join(' ') || '—'} |`)
    .join('\n');

  const policies = (['stable', 'beta', 'experimental'] as const).map(level => {
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
    'CAPABILITY_EVIDENCE.md': `${title('Yetenek Kanıtları')}Bu belge, \`src/v4/capability-registry.ts\` kayıtları ve ölçülen senaryo sonuçları için insan tarafından okunabilir indekstir.\n\n## Kanıt seviyeleri\n\n- Otomatik test: unit, integration, browser E2E veya native E2E.\n- Senaryo kanıtı: sürümlenmiş benchmark proje sonucu.\n- Kullanıcı kanıtı: anonimleştirilmiş, açık yöntemli kullanılabilirlik sonucu.\n\n## Destek seviyeleri\n\n${supportOrder.map(level => `- **${level}:** ${PRODUCT_CONTRACT.supportedProjects.filter(item => item.support === level).length} proje türü`).join('\n')}\n\nGerçek kullanıcı ve benchmark sayısı bulunmadan hiçbir capability için sonuç başarısı iddia edilmez.\n`
  };
}
