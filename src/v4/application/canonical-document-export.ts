import type { ModuleManifest, ProjectDocumentV5 } from '../contracts.js'
import type { CanonicalRevisionReference } from './canonical-export-core.js'
import { resolveCanonicalRevision } from './canonical-export-core.js'
import { assertIdeaPlanAlignment } from './canonical-export-service.js'

export const DEFAULT_DOCUMENT_ADAPTERS = Object.freeze([
  'generic',
  'codex',
  'cursor',
  'claude',
  'windsurf',
  'copilot'
])

export interface CanonicalDocumentDependencies {
  generateArchitectureDiagram(project: ProjectDocumentV5): string
  generateDataFlowDiagram(project: ProjectDocumentV5): string
  createModuleRegistry(manifests: ModuleManifest[]): ReadonlyMap<string, ModuleManifest>
}

export interface CanonicalDocumentOptions {
  revision?: CanonicalRevisionReference
  adapters?: string[]
}

export interface DecisionDocumentOptions {
  title?: string
  acceptedOnly?: boolean
  includeIds?: boolean
}

export interface CanonicalDocumentExporter {
  exportCanonicalMarkdown(project: ProjectDocumentV5, revision?: CanonicalRevisionReference): string
  buildAgentPrompt(project: ProjectDocumentV5, adapter?: string, revision?: CanonicalRevisionReference): string
  renderDecisionDocument(project: ProjectDocumentV5, options?: DecisionDocumentOptions): string
  createDocumentSet(project: ProjectDocumentV5, options?: CanonicalDocumentOptions): Record<string, string>
}

interface ReviewSummary {
  score: number
  revision: number
}

function reviewSummary(value: unknown): ReviewSummary | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<ReviewSummary>
  return typeof candidate.score === 'number' && typeof candidate.revision === 'number'
    ? { score: candidate.score, revision: candidate.revision }
    : null
}

export function createCanonicalDocumentExporter(
  dependencies: CanonicalDocumentDependencies
): CanonicalDocumentExporter {
  const bulletList = (items: readonly string[] | undefined, empty = '_Henüz kayıt yok._') =>
    items?.length ? items.map(item => `- ${item}`).join('\n') : empty

  const sectionMarkdown = (section: ProjectDocumentV5['sections'][string] | undefined) => {
    if (!section) return '_Bu plan derinliğinde etkin değil._'
    const body = [section.content, ...(section.items || []).map(item => `- ${item}`)]
      .filter(Boolean)
      .join('\n\n')
    return `## ${section.title}\n\n${body || '_Henüz içerik yok._'}`
  }

  const entityDocument = <T>(title: string, items: readonly T[], render: (item: T) => string) =>
    `# ${title}\n\n${items.length ? items.map(render).join('\n\n') : '_Henüz kayıt yok._'}`

  const renderDecisionDocument = (
    project: ProjectDocumentV5,
    {
      title = 'Mimari Kararlar',
      acceptedOnly = false,
      includeIds = false
    }: DecisionDocumentOptions = {}
  ) => {
    const decisions = acceptedOnly
      ? project.decisions.filter(item => item.status === 'accepted')
      : project.decisions
    return entityDocument(title, decisions, item =>
      `## ${includeIds ? `${item.id} — ` : ''}${item.title}\n\n${item.decision}\n\n**Gerekçe:** ${item.rationale || 'Belirtilmedi.'}`
    )
  }

  const exportCanonicalMarkdown = (
    project: ProjectDocumentV5,
    revision: CanonicalRevisionReference = 'current'
  ) => {
    const source = resolveCanonicalRevision(project, revision)
    assertIdeaPlanAlignment(source)
    const visible = Object.values(source.sections).filter(
      section => section.required || section.content || section.items.length
    )
    const archDiagram = dependencies.generateArchitectureDiagram(source)
    const acceptedDecisions = source.decisions.filter(item => item.status === 'accepted')
    return [
      `# ${source.identity.name}`,
      `> Plan sürümü ${source.canonicalRevision} · ${source.planningDepth.selected.toUpperCase()} · Hazırlık ${source.readiness.score}/100`,
      `**Başlangıç fikri:** ${source.identity.originalIdea}`,
      ...visible.map(sectionMarkdown),
      '## Mimari Şema',
      '```mermaid\n' + archDiagram + '\n```',
      '## Kabul Edilmiş Kararlar',
      acceptedDecisions.length
        ? acceptedDecisions
            .map(item => `- **${item.title}:** ${item.decision}${item.rationale ? ` — ${item.rationale}` : ''}`)
            .join('\n')
        : '_Henüz karar yok._',
      '## Plan Geçmişi',
      `Toplama ${source.revisions.length} revizyon kaydedildi. Son revizyon: r${source.canonicalRevision}.`,
      '## Açık Uyarılar',
      bulletList([...source.readiness.blockers, ...source.readiness.warnings], '_Açık uyarı yok._')
    ].join('\n\n')
  }

  const prdMarkdown = (project: ProjectDocumentV5) => [
    `# ${project.identity.name} — Ürün Gereksinimleri`,
    '## Problem ve beklenen sonuç',
    project.sections.vision?.content || project.identity.originalIdea,
    '## Hedefler',
    project.objectives.length
      ? project.objectives
          .map(item => `- **${item.title}**${item.metric ? ` — ${item.metric}: ${item.target || 'belirlenecek'}` : ''}`)
          .join('\n')
      : sectionMarkdown(project.sections.objectives),
    '## Kapsam',
    project.sections.scope?.content || bulletList(project.sections.scope?.items),
    '## Başarı ve kabul',
    project.requirements.length
      ? project.requirements.flatMap(item => item.acceptanceCriteria.map(criterion => `- ${item.id}: ${criterion}`)).join('\n') ||
        '_Kabul kriterleri henüz tanımlanmadı._'
      : '_Gereksinimler henüz yapılandırılmadı._'
  ].join('\n\n')

  const taskDocument = (project: ProjectDocumentV5) => {
    if (!project.tasks.length) return sectionMarkdown(project.sections.tasks)
    return entityDocument('Görevler ve Yol Haritası', project.tasks, item => {
      const contract = item.contract
      const filePolicy = contract?.filePolicy
      const verification = contract?.verification
      return [
        `## ${item.id} — ${item.title}`,
        item.description,
        `- Durum: ${item.status}`,
        `- Öncelik / efor: ${item.priority} / ${item.effort}`,
        item.dependencies.length ? `- Bağımlılıklar: ${item.dependencies.join(', ')}` : '',
        item.requirementIds.length ? `- Kaynak gereksinimler: ${item.requirementIds.join(', ')}` : '',
        item.acceptanceCriteria.length ? `### Kabul kriterleri\n${bulletList(item.acceptanceCriteria)}` : '',
        contract && filePolicy && verification
          ? [
              '### TaskContract V2',
              `**Amaç:** ${contract.objective}`,
              `**Kapsam içi:**\n${bulletList(contract.inScope)}`,
              `**Kapsam dışı:**\n${bulletList(contract.outOfScope)}`,
              `**Dosya politikası:** ${filePolicy.status}`,
              `- İzinli yollar: ${filePolicy.allowedPaths.join(', ') || 'Proje envanteri ve kullanıcı onayı gerekli'}`,
              `- Yasak yollar: ${filePolicy.forbiddenPaths.join(', ')}`,
              `**Test senaryoları:** ${verification.testCaseIds.join(', ')}`,
              `**Çalıştırılacak komutlar:** ${verification.commands.join(', ') || 'Mevcut proje komutları keşfedilmeli; keşif tamamlanmadan başarı beyan edilemez.'}`,
              `**Beklenen çıktılar:**\n${bulletList(contract.expectedOutputs)}`,
              `**Tamamlanma kanıtı:**\n${bulletList(contract.completionEvidence)}`,
              `**Geri alma:** ${contract.rollbackPlan}`
            ].join('\n\n')
          : ''
      ].filter(Boolean).join('\n')
    })
  }

  const traceabilityDocument = (project: ProjectDocumentV5) => [
    '# İzlenebilirlik Matrisi',
    '| Kaynak | İlişki | Hedef |',
    '|---|---|---|',
    ...(project.traceLinks.length
      ? project.traceLinks.map(link => `| ${link.fromType}:${link.fromId} | ${link.relation} | ${link.toType}:${link.toId} |`)
      : ['| — | Henüz bağlantı yok | — |'])
  ].join('\n')

  const agentRunbookDocument = (project: ProjectDocumentV5) =>
    entityDocument('Ajan Çalıştırma Zinciri', project.agentPrompts, prompt => [
      `## ${prompt.role.toUpperCase()} — ${prompt.title}`,
      prompt.instructions,
      `- Görevler: ${prompt.taskIds.join(', ') || 'Henüz bağlanmadı'}`,
      prompt.dependsOnPromptIds.length ? `- Ön koşul promptları: ${prompt.dependsOnPromptIds.join(', ')}` : '',
      prompt.expectedOutputs.length ? `### Beklenen çıktılar\n${bulletList(prompt.expectedOutputs)}` : ''
    ].filter(Boolean).join('\n\n'))

  const researchDocument = (project: ProjectDocumentV5) => {
    const questions = project.researchQuestions.length
      ? project.researchQuestions
          .map(question => `- [${question.status === 'answered' ? 'x' : ' '}] ${question.question} (${question.priority})`)
          .join('\n')
      : '_Araştırma sorusu yok._'
    const evidence = project.evidence.length
      ? project.evidence.map(item => {
          const source = project.sources.find(candidate => candidate.id === item.sourceId)
          return `## ${item.claim}\n\n${item.summary}\n\nKaynak: [${source?.title || source?.url || 'Kaynak'}](${source?.url || '#'}) · ${source?.sourceType || 'unknown'} · Güven: ${item.confidence}`
        }).join('\n\n')
      : '_Onaylı kanıt yok._'
    return `# Araştırma ve Kanıt Defteri\n\n## Sorular\n\n${questions}\n\n## Kanıtlar\n\n${evidence}`
  }

  const reviewDocument = (project: ProjectDocumentV5) => {
    const lastReview = reviewSummary(project.metadata.lastReview)
    const findings = project.reviewFindings.length
      ? project.reviewFindings
          .map(item => `- **${item.severity.toUpperCase()} · ${item.ruleId}: ${item.title}** — ${item.description} Öneri: ${item.recommendation}`)
          .join('\n')
      : '_Kayıtlı bulgu yok._'
    const simulations = project.simulationRuns.length
      ? project.simulationRuns.slice(-4).map(run => `- **${run.title}: ${run.status}** — ${run.summary}`).join('\n')
      : '_Simülasyon çalıştırılmadı._'
    return `# Plan Kalite İncelemesi\n\n${lastReview ? `Skor: **${lastReview.score}/100** · İncelenen revision: r${lastReview.revision}` : 'Henüz inceleme çalıştırılmadı.'}\n\n## Bulgular\n\n${findings}\n\n## Simülasyonlar\n\n${simulations}`
  }

  const architectureDocument = (project: ProjectDocumentV5) => `# System Architecture & Diagrams — ${project.identity.name}

## System Components
\`\`\`mermaid
${dependencies.generateArchitectureDiagram(project)}
\`\`\`

## Data Flow & Execution Sequence
\`\`\`mermaid
${dependencies.generateDataFlowDiagram(project)}
\`\`\`

## Architectural Decisions
${project.decisions.length ? project.decisions.map(item => `- **${item.title}:** ${item.decision}`).join('\n') : '_Henüz karar kaydedilmedi._'}
`

  const modulesDocument = (project: ProjectDocumentV5) => {
    const registry = dependencies.createModuleRegistry(project.modules.localManifests || [])
    const active = project.modules.active.length
      ? project.modules.active.map(item => {
          const manifest = registry.get(item.id)
          const domainPack = manifest?.version === item.version ? manifest.contributions.domainPack : null
          const details = domainPack
            ? `\n  - Olgunluk: ${domainPack.maturity}\n  - Destek: ${domainPack.projectTypes.join(', ')}\n  - Sınırlama: ${domainPack.limitations.join(' ')}`
            : ''
          return `- **${item.id}** v${item.version} · r${item.enabledAtRevision}${details}`
        }).join('\n')
      : '_Aktif modül yok._'
    return `# Aktif Planlama Modülleri\n\n${active}\n\nModüller yalnız deklaratif bölüm, reviewer ve export katkıları sağlar; çalıştırılabilir kod içermez. Alan paketleri teknoloji seçmez ve kullanıcı onayı olmadan canonical plana karar yazmaz.`
  }

  const moduleContributionDocument = (
    project: ProjectDocumentV5,
    manifest: ModuleManifest,
    documentId: string
  ) => {
    const sectionIds = [...new Set([
      ...(manifest.contributions.requiredSections || []),
      ...(manifest.contributions.suggestedSections || [])
    ])]
    return [
      `# ${manifest.name} — ${documentId}`,
      manifest.description,
      `Kaynak canonical plan: r${project.canonicalRevision}`,
      ...sectionIds.map(sectionId => sectionMarkdown(project.sections[sectionId])),
      '## Alan kalite kontrolleri',
      bulletList(manifest.contributions.reviewerRuleIds || [], '_Alan kuralı tanımlanmadı._')
    ].join('\n\n')
  }

  const executionHistoryDocument = (project: ProjectDocumentV5) => {
    if (!project.executionSessions.length) return '# Ajan Execution Geçmişi\n\n_Henüz execution session yok._'
    return `# Ajan Execution Geçmişi\n\n${project.executionSessions.map(session => [
      `## ${session.adapterId} · ${session.status}`,
      `Kaynak plan: r${session.sourceRevision} · ${session.worktreeLabel || 'haricî çalışma'}`,
      ...session.steps.map(step => `- **${step.role}** — ${step.status} · risk ${step.risk}${step.exitCode == null ? '' : ` · exit ${step.exitCode}`}`)
    ].join('\n')).join('\n\n')}`
  }

  const buildAgentPrompt = (
    project: ProjectDocumentV5,
    adapter = 'generic',
    revision: CanonicalRevisionReference = 'current'
  ) => {
    const source = resolveCanonicalRevision(project, revision)
    const labels: Record<string, string> = {
      generic: 'Genel Kodlama Ajanı',
      codex: 'OpenAI Codex',
      cursor: 'Cursor',
      claude: 'Claude Code',
      windsurf: 'Windsurf',
      copilot: 'GitHub Copilot'
    }
    return [
      `# ${labels[adapter] || labels.generic} Uygulama Promptu`,
      `Kaynak: canonical plan r${source.canonicalRevision}. Aşağıdaki planı tek doğruluk kaynağı kabul et; kabul edilmiş kararlarla çelişme.`,
      'Önce mevcut kod tabanını incele, sonra bağımlılık sırasına göre küçük ve doğrulanabilir adımlarla uygula. Her adımda testleri çalıştır; belirsizlikte varsayımı açıkça yaz.',
      adapter === 'codex' ? 'Değişiklikleri workspace içinde uygula; test sonuçlarını ve kalan riskleri özetle.' : '',
      adapter === 'cursor' ? 'Planı uygulanabilir görevler halinde ele al ve ilgili dosyaları bağlama ekle.' : '',
      adapter === 'claude' ? 'Önce plan ile mevcut sistem arasındaki farkları çıkar, sonra bağımlılık sırasıyla uygula.' : '',
      'Her görev tesliminde `.promtgen/evidence/templates/` altındaki sürümlü JSON şablonunu gerçek dosya, test ve kabul kriteri kanıtlarıyla doldur. PromtGen bu paketi kullanıcıya önizletir; sen canonical görev durumunu doğrudan değiştiremezsin.',
      taskDocument(source),
      exportCanonicalMarkdown(source)
    ].filter(Boolean).join('\n\n')
  }

  const createDocumentSet = (
    project: ProjectDocumentV5,
    { revision = 'current', adapters = [...DEFAULT_DOCUMENT_ADAPTERS] }: CanonicalDocumentOptions = {}
  ) => {
    const source = resolveCanonicalRevision(project, revision)
    const depth = source.planningDepth.selected
    const documents: Record<string, string> = {
      'plan/master-plan.md': exportCanonicalMarkdown(source),
      'documents/prd.md': prdMarkdown(source),
      'documents/tasks.md': taskDocument(source),
      'documents/modules.md': modulesDocument(source),
      'agents/runbook.md': agentRunbookDocument(source),
      'agents/execution-history.md': executionHistoryDocument(source)
    }
    if (depth !== 'quick') Object.assign(documents, {
      'documents/requirements.md': sectionMarkdown(source.sections.requirements),
      'documents/architecture.md': architectureDocument(source),
      'documents/risks.md': sectionMarkdown(source.sections.risks),
      'documents/test-strategy.md': sectionMarkdown(source.sections.testing)
    })
    if (['advanced', 'enterprise'].includes(depth)) Object.assign(documents, {
      'documents/decisions.md': renderDecisionDocument(source),
      'documents/security.md': sectionMarkdown(source.sections.security),
      'documents/deployment.md': sectionMarkdown(source.sections.deployment),
      'documents/research.md': researchDocument(source),
      'documents/review.md': reviewDocument(source)
    })
    if (depth === 'enterprise') Object.assign(documents, {
      'documents/operations.md': sectionMarkdown(source.sections.operations),
      'documents/traceability.md': traceabilityDocument(source)
    })
    const registry = dependencies.createModuleRegistry(source.modules.localManifests || [])
    const builtInDocumentIds = new Set([
      'master-plan',
      'tasks',
      'requirements',
      'architecture',
      'test-strategy',
      'deployment',
      'security',
      'risks',
      'research',
      'prd'
    ])
    for (const active of source.modules.active || []) {
      const manifest = registry.get(active.id)
      if (!manifest) continue
      for (const documentId of manifest.contributions.exportDocumentIds || []) {
        if (builtInDocumentIds.has(documentId)) continue
        documents[`documents/modules/${documentId}.md`] = moduleContributionDocument(source, manifest, documentId)
      }
    }
    for (const adapter of adapters) documents[`agents/${adapter}.md`] = buildAgentPrompt(source, adapter)
    return documents
  }

  return { exportCanonicalMarkdown, buildAgentPrompt, renderDecisionDocument, createDocumentSet }
}
