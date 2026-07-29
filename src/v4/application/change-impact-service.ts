import {
  normalizeDecision,
  normalizeRequirement,
  normalizeRisk,
  normalizeTask,
  normalizeTestCase,
  normalizeTraceLink
} from '../canonical-entities.js'
import { analyzeCanonicalImpact } from '../canonical-graph.js'
import { captureCurrentRevision, recalculateReadiness } from '../planning-engine.js'
import type { ImpactAnalysis, ProjectDocumentV5 } from '../contracts.js'
import { alignPlanToIdeaRevision } from '../domain/idea-plan-alignment.js'
import { createRequirementDraftsFromConcept } from './requirement-quality-service.js'

const STOP_WORDS = new Set([
  'artık', 'icin', 'için', 'olan', 'olarak', 'bunu', 'buna', 'bunun', 'daha',
  'gibi', 'ile', 've', 'veya', 'ama', 'bir', 'bu', 'da', 'de', 'mi', 'mu',
  'istiyorum', 'ekle', 'eklemek', 'yap', 'yapmak', 'olsun', 'olmalı'
])

const SECTION_BY_TYPE: Record<string, string> = {
  objective: 'objectives',
  requirement: 'requirements',
  decision: 'decisions',
  assumption: 'requirements',
  risk: 'risks',
  task: 'tasks',
  test: 'testing',
  milestone: 'tasks'
}

function now() {
  return new Date().toISOString()
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeWord(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9çğıöşü]+/gi, '')
}

function tokens(value: string) {
  return [...new Set(String(value || '')
    .split(/\s+/)
    .map(normalizeWord)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word)))]
}

function tokenMatches(left: string, right: string) {
  return left === right || (left.length > 4 && right.length > 4 && (left.startsWith(right) || right.startsWith(left)))
}

function relevanceScore(query: string[], candidate: string) {
  const candidateTokens = tokens(candidate)
  return query.reduce((score, queryToken) =>
    score + (candidateTokens.some(candidateToken => tokenMatches(queryToken, candidateToken)) ? 1 : 0), 0)
}

function relatedEntities(project: ProjectDocumentV5, request: string) {
  const query = tokens(request)
  const candidates = [
    ...project.decisions.map(entity => ({ id: entity.id, type: 'decision', label: entity.title, text: `${entity.title} ${entity.decision}` })),
    ...project.requirements.map(entity => ({ id: entity.id, type: 'requirement', label: entity.title, text: `${entity.title} ${entity.statement}` })),
    ...project.objectives.map(entity => ({ id: entity.id, type: 'objective', label: entity.title, text: `${entity.title} ${entity.description}` })),
    ...project.risks.map(entity => ({ id: entity.id, type: 'risk', label: entity.title, text: `${entity.title} ${entity.description}` }))
  ]
  return candidates
    .map(candidate => ({ ...candidate, score: relevanceScore(query, candidate.text) }))
    .filter(candidate => candidate.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 6)
}

function inferSections(request: string) {
  const value = request.toLocaleLowerCase('tr-TR')
  const sections = new Set(['scope', 'requirements', 'tasks', 'testing'])
  if (/mimari|fizik|network|ağ|senkron|veri|api|entegrasyon|performans/.test(value)) sections.add('architecture')
  if (/güvenlik|auth|kimlik|yetki|secret|privacy|gizlilik/.test(value)) sections.add('security')
  if (/risk|tehlike|hata|çök|gecik/.test(value)) sections.add('risks')
  if (/deploy|dağıt|yayın|release|kurulum/.test(value)) sections.add('deployment')
  return sections
}

function normalizeEffects(rawEffects: unknown[]) {
  return rawEffects.map(rawEffect => {
    const effect = rawEffect && typeof rawEffect === 'object'
      ? rawEffect as Record<string, unknown>
      : {}
    return {
      sourceEntityId: String(effect.sourceEntityId || ''),
      sourceType: String(effect.sourceType || ''),
      targetEntityId: String(effect.targetEntityId || ''),
      targetType: String(effect.targetType || ''),
      targetLabel: String(effect.targetLabel || effect.targetEntityId || ''),
      effect: effect.effect as ImpactAnalysis['entityEffects'][number]['effect'],
      severity: effect.severity as ImpactAnalysis['entityEffects'][number]['severity'],
      depth: Number(effect.depth || 0)
    }
  })
}

export function createChangeImpactAnalysis(
  project: ProjectDocumentV5,
  userRequest: string,
  _options: { pendingCommit?: boolean } = {}
) {
  const cleanRequest = String(userRequest || '').trim()
  if (!cleanRequest) throw new Error('Değişiklik isteği boş olamaz.')

  const related = relatedEntities(project, cleanRequest)
  const changedEntityIds = related.map(entity => entity.id)
  const graphImpact = changedEntityIds.length
    ? analyzeCanonicalImpact(project, changedEntityIds)
    : { effects: [], summary: { total: 0, byEffect: {}, bySeverity: {} } }
  const entityEffects = normalizeEffects(graphImpact.effects || [])
  const effectSummary = {
    total: Number(graphImpact.summary?.total || entityEffects.length),
    byEffect: { ...(graphImpact.summary?.byEffect || {}) } as Record<string, number>,
    bySeverity: { ...(graphImpact.summary?.bySeverity || {}) } as Record<string, number>
  }
  const affectedSections = inferSections(cleanRequest)
  for (const entity of related) affectedSections.add(SECTION_BY_TYPE[entity.type] || 'scope')
  for (const effect of entityEffects) affectedSections.add(SECTION_BY_TYPE[effect.targetType] || 'scope')

  const contradictionDetails = project.decisions
    .filter(decision =>
      decision.status === 'accepted'
      && /kapsam dışı|hariç|ertelen|yapılmayacak|desteklenmeyecek/i.test(decision.decision)
      && relevanceScore(tokens(cleanRequest), `${decision.title} ${decision.decision}`) > 0)
    .map(decision => ({
      decisionId: decision.id,
      decisionTitle: decision.title,
      decisionText: decision.decision,
      resolution: null
    }))

  const baseCanonicalRevision = project.canonicalRevision
  const impact: ImpactAnalysis = {
    id: id('impact'),
    baseCanonicalRevision,
    userRequest: cleanRequest,
    summary: `"${cleanRequest}" isteği uygulanmadan önce ilişkili kararlar, gereksinimler, görevler ve testler yeniden doğrulanacak.`,
    affectedSections: [...affectedSections],
    changedEntityIds,
    entityEffects,
    effectSummary,
    newTasks: [
      `${cleanRequest} için canonical gereksinim ve uygulama değişikliği`,
      `${cleanRequest} için kabul ve regresyon doğrulaması`
    ],
    architectureImpact: affectedSections.has('architecture')
      ? 'Mimari kararlar ve ilişkili uygulama bileşenleri yeniden incelenecek.'
      : 'Mevcut mimari korunacak; değişiklik izlenebilir bir gereksinim olarak eklenecek.',
    newRisks: ['Kapsam değişikliğinin mevcut davranışlarda regresyon oluşturması'],
    contradictions: contradictionDetails.map(detail => `"${detail.decisionTitle}" kararı yeni istekle çelişiyor.`),
    contradictionDetails,
    preview: {
      nextCanonicalRevision: baseCanonicalRevision + 1,
      requirementCount: 1,
      taskCount: 1,
      testCount: 1,
      riskCount: 1,
      traceLinkCount: Math.max(2, changedEntityIds.length + 2)
    },
    status: 'proposed',
    createdAt: now(),
    resolvedAt: null
  }

  const next = structuredClone(project)
  next.impactAnalyses = [...(next.impactAnalyses || []), impact]
  return { project: next, impact }
}

export function createIdeaAlignmentImpactAnalysis(project: ProjectDocumentV5) {
  const alignment = project.planAlignment
  if (!alignment || alignment.status === 'aligned') {
    throw new Error('Canonical plan ile fikir belgesi zaten hizalı.')
  }
  if (!alignment.currentIdeaRevisionId) {
    throw new Error('İncelenecek güncel fikir sürümü bulunamadı.')
  }
  const existing = (project.impactAnalyses || []).find(impact =>
    impact.status === 'proposed'
    && impact.sourceKind === 'idea_alignment'
    && impact.currentIdeaRevisionId === alignment.currentIdeaRevisionId
  )
  if (existing) return { project, impact: existing }

  const request = `Fikir belgesi r${alignment.currentIdeaRevisionNumber} değişikliklerini canonical plana yansıt`
  const result = createChangeImpactAnalysis(project, request)
  result.impact.sourceKind = 'idea_alignment'
  result.impact.sourceIdeaRevisionId = alignment.sourceIdeaRevisionId || undefined
  result.impact.currentIdeaRevisionId = alignment.currentIdeaRevisionId
  result.impact.affectedSections = [...alignment.affectedSections]
  result.impact.summary = `${alignment.changedFields.length} fikir alanı değişti: ${alignment.changedFields.join(', ')}. Canonical plan yalnız açık onaydan sonra güncellenecek.`
  result.impact.architectureImpact = alignment.affectedSections.includes('architecture')
    ? 'Teknik yaklaşım değiştiği için mimari ve bağlı görevler yeniden doğrulanacak.'
    : 'Mimari yalnız etkilenen plan bağlantıları gerektiriyorsa güncellenecek.'
  result.impact.preview = {
    nextCanonicalRevision: project.canonicalRevision + 1,
    requirementCount: alignment.changedFields.includes('confirmedFeatures') ? 1 : 0,
    taskCount: 0,
    testCount: 0,
    riskCount: alignment.changedFields.includes('knownRisks') ? 1 : 0,
    traceLinkCount: 0
  }
  return result
}

export function resolveImpactContradiction(
  project: ProjectDocumentV5,
  impactId: string,
  decisionId: string,
  resolution: 'supersede' | 'keep'
) {
  const next = structuredClone(project)
  const impact = (next.impactAnalyses || []).find(item => item.id === impactId)
  const detail = impact?.contradictionDetails.find(item => item.decisionId === decisionId)
  if (!impact || impact.status !== 'proposed' || !detail) return project
  detail.resolution = resolution
  return next
}

export function rejectChangeImpact(project: ProjectDocumentV5, impactId: string) {
  const next = structuredClone(project)
  const impact = (next.impactAnalyses || []).find(item => item.id === impactId)
  if (!impact || impact.status !== 'proposed') return project
  impact.status = 'rejected'
  impact.resolvedAt = now()
  return next
}

export function applyChangeImpact(
  project: ProjectDocumentV5,
  impactId: string,
  resolutions: Record<string, 'supersede' | 'keep'> = {}
) {
  const sourceImpact = (project.impactAnalyses || []).find(item => item.id === impactId)
  if (!sourceImpact || sourceImpact.status !== 'proposed') {
    return { success: false, project, reason: 'Uygulanabilir etki analizi bulunamadı.' }
  }
  if (sourceImpact.baseCanonicalRevision !== project.canonicalRevision) {
    const stale = structuredClone(project)
    const impact = (stale.impactAnalyses || []).find(item => item.id === impactId)
    if (impact) impact.status = 'stale'
    return { success: false, project: stale, reason: `Plan r${sourceImpact.baseCanonicalRevision} sonrasında değişti; etki analizi yenilenmeli.` }
  }
  const effectiveDetails = sourceImpact.contradictionDetails.map(detail => ({
    ...detail,
    resolution: resolutions[detail.decisionId] || detail.resolution
  }))
  const unresolved = effectiveDetails.filter(detail => !detail.resolution)
  if (unresolved.length) {
    return { success: false, project, reason: `${unresolved.length} karar çelişkisi çözüm bekliyor.` }
  }

  if (sourceImpact.sourceKind === 'idea_alignment') {
    return applyIdeaAlignmentImpact(project, sourceImpact, effectiveDetails)
  }

  const next = structuredClone(project)
  const impact = (next.impactAnalyses || []).find(item => item.id === impactId)!
  impact.contradictionDetails = effectiveDetails
  const acceptedRequirementIds = new Set<string>()
  for (const effect of impact.entityEffects) {
    if (effect.targetType === 'requirement' && next.requirements.some(requirement => requirement.id === effect.targetEntityId && requirement.status === 'accepted')) {
      acceptedRequirementIds.add(effect.targetEntityId)
    }
  }
  for (const entityId of impact.changedEntityIds) {
    if (next.requirements.some(requirement => requirement.id === entityId && requirement.status === 'accepted')) {
      acceptedRequirementIds.add(entityId)
    }
  }

  const supersededDecisionIds: string[] = []
  for (const detail of impact.contradictionDetails) {
    if (detail.resolution !== 'supersede') continue
    const decision = next.decisions.find(item => item.id === detail.decisionId)
    if (decision) {
      decision.status = 'superseded'
      supersededDecisionIds.push(decision.id)
    }
  }

  const replacementDecision = supersededDecisionIds.length
    ? normalizeDecision({
        id: id('decision'),
        title: `Revize karar: ${impact.userRequest}`,
        decision: impact.userRequest,
        rationale: 'Kullanıcı tarafından etki analizi ve diff önizlemesi incelenerek kabul edildi.',
        status: 'accepted',
        affectedSectionIds: impact.affectedSections
      })
    : null
  if (replacementDecision) next.decisions.push(replacementDecision)

  const requirement = normalizeRequirement({
    id: id('requirement'),
    title: impact.userRequest,
    statement: impact.userRequest,
    kind: 'functional',
    priority: 'must',
    acceptanceCriteria: [`"${impact.userRequest}" davranışı kabul testinde doğrulanır.`],
    status: 'accepted'
  })
  next.requirements.push(requirement)
  acceptedRequirementIds.add(requirement.id)

  const testCase = normalizeTestCase({
    id: id('test'),
    title: `${impact.userRequest} kabul testi`,
    kind: 'acceptance',
    steps: ['Değişiklik senaryosunu çalıştır.', 'Canonical plan sonucunu doğrula.'],
    expectedResult: impact.userRequest,
    requirementIds: [requirement.id],
    status: 'ready'
  })
  next.testCases.push(testCase)

  const task = normalizeTask({
    id: id('task'),
    title: impact.newTasks[0] || impact.userRequest,
    description: `Etki analizi ${impact.id} üzerinden üretildi.`,
    status: 'backlog',
    priority: 'must',
    effort: 'medium',
    requirementIds: [...acceptedRequirementIds],
    acceptanceCriteria: requirement.acceptanceCriteria,
    verificationIds: [testCase.id]
  })
  next.tasks.push(task)

  for (const riskTitle of impact.newRisks) {
    if (!next.risks.some(risk => risk.title === riskTitle)) {
      next.risks.push(normalizeRisk({
        id: id('risk'),
        title: riskTitle,
        description: `Etki analizi ${impact.id} sırasında tespit edildi.`,
        probability: 'medium',
        impact: 'medium',
        mitigation: 'Yeni kabul testi ve revision karşılaştırmasıyla doğrula.',
        status: 'open'
      }))
    }
  }

  const newLinks = [
    ...(replacementDecision ? [{
      fromType: 'decision', fromId: replacementDecision.id,
      toType: 'requirement', toId: requirement.id, relation: 'drives'
    }] : []),
    ...supersededDecisionIds.map(decisionId => ({
      fromType: 'decision', fromId: replacementDecision!.id,
      toType: 'decision', toId: decisionId, relation: 'supersedes'
    })),
    { fromType: 'requirement', fromId: requirement.id, toType: 'task', toId: task.id, relation: 'implements' },
    { fromType: 'requirement', fromId: requirement.id, toType: 'test', toId: testCase.id, relation: 'validated_by' }
  ]
  for (const link of newLinks) {
    next.traceLinks.push(normalizeTraceLink({ id: id('trace'), ...link }))
  }

  for (const sectionId of impact.affectedSections) {
    const section = next.sections[sectionId]
    if (!section) continue
    section.status = section.content || section.items.length ? 'stale' : 'draft'
    section.updatedAtRevision = project.canonicalRevision + 1
    const warning = `"${impact.userRequest}" değişikliği nedeniyle yeniden doğrulanmalı.`
    if (!section.warnings.includes(warning)) section.warnings.push(warning)
  }
  if (next.sections.requirements) {
    next.sections.requirements.items = [...new Set([...next.sections.requirements.items, requirement.statement])]
  }
  if (next.sections.tasks) {
    next.sections.tasks.items = [...new Set([...next.sections.tasks.items, task.title])]
  }
  if (next.sections.testing) {
    next.sections.testing.items = [...new Set([...next.sections.testing.items, testCase.title])]
  }

  impact.status = 'accepted'
  impact.resolvedAt = now()
  if (impact.sourceScenarioId) {
    const scenario = next.planningScenarios.find(item => item.id === impact.sourceScenarioId)
    if (scenario) {
      scenario.status = 'merged'
      scenario.impactAnalysisId = impact.id
      scenario.mergedAt = impact.resolvedAt
      scenario.updatedAt = impact.resolvedAt
    }
  }
  next.documentRevision += 1
  next.canonicalRevision += 1
  next.lifecycle.status = 'active'
  next.lifecycle.updatedAt = now()

  const recalculated = recalculateReadiness(next)
  const versioned = captureCurrentRevision(
    recalculated,
    `Etki analizi uygulandı: ${impact.userRequest}`
  )
  return { success: true, project: versioned, reason: '' }
}

function applyIdeaAlignmentImpact(
  project: ProjectDocumentV5,
  sourceImpact: ImpactAnalysis,
  effectiveDetails: ImpactAnalysis['contradictionDetails']
) {
  const alignment = project.planAlignment
  if (
    alignment.status === 'aligned'
    || !alignment.currentIdeaRevisionId
    || sourceImpact.currentIdeaRevisionId !== alignment.currentIdeaRevisionId
  ) {
    return { success: false, project, reason: 'Fikir belgesi etki önizlemesinden sonra değişti; analiz yenilenmeli.' }
  }
  const currentRevision = project.ideaDocumentRevisions.find(item => item.id === alignment.currentIdeaRevisionId)
  const summary = project.ideaLabSession?.conceptSummary
  if (!currentRevision || !summary) {
    return { success: false, project, reason: 'Canonical plana uygulanacak fikir sürümü bulunamadı.' }
  }

  let next = structuredClone(project)
  const impact = next.impactAnalyses!.find(item => item.id === sourceImpact.id)!
  const nextSummary = next.ideaLabSession!.conceptSummary!
  nextSummary.userConfirmed = true
  nextSummary.confirmedAt = now()
  next.ideaLabSession!.status = 'confirmed'
  impact.contradictionDetails = effectiveDetails
  impact.status = 'accepted'
  impact.resolvedAt = now()

  next.identity.summary = nextSummary.summary
  next.identity.desiredOutcome = nextSummary.desiredOutcome
  next.sections.vision.content = [
    nextSummary.summary,
    `Hedef kullanıcı: ${nextSummary.targetUser}`,
    `Problem: ${nextSummary.problemStatement}`,
    `Mevcut çözüm: ${nextSummary.currentAlternative}`,
    `Beklenen sonuç: ${nextSummary.desiredOutcome}`
  ].join('\n\n')
  next.sections.scope.items = [...nextSummary.confirmedFeatures]
  next.sections.scope.content = [
    `MVP hedefi: ${nextSummary.mvpTarget}`,
    `Kapsam dışı:\n${nextSummary.outOfScope.map(item => `- ${item}`).join('\n')}`
  ].join('\n\n')
  next.sections.architecture.items = [...nextSummary.technicalApproaches]
  next.sections.risks.items = [...nextSummary.knownRisks]

  const acceptedObjective = next.objectives.find(item => item.status === 'accepted')
  if (acceptedObjective) {
    acceptedObjective.title = nextSummary.mvpTarget
    acceptedObjective.description = nextSummary.desiredOutcome
  }
  next.requirements = next.requirements.filter(requirement =>
    requirement.status !== 'draft'
    || nextSummary.confirmedFeatures.some(feature => requirement.title === feature)
  )
  for (const riskTitle of nextSummary.knownRisks) {
    if (!next.risks.some(risk => risk.title === riskTitle)) {
      next.risks.push(normalizeRisk({
        id: id('risk'),
        title: riskTitle,
        description: 'Fikir belgesi hizalama incelemesinde kabul edildi.',
        status: 'open'
      }))
    }
  }
  next = createRequirementDraftsFromConcept(next)
  next.documentRevision += 1
  next.canonicalRevision += 1
  next.lifecycle.status = 'active'
  next.lifecycle.updatedAt = now()
  for (const sectionId of alignment.affectedSections) {
    const section = next.sections[sectionId]
    if (!section) continue
    section.updatedAtRevision = next.canonicalRevision
    section.status = ['tasks', 'testing'].includes(sectionId) ? 'stale' : 'draft'
    const warning = `Fikir belgesi r${currentRevision.number} değişikliği sonrası yeniden doğrulanmalı.`
    section.warnings = ['tasks', 'testing'].includes(sectionId)
      ? [...new Set([...section.warnings, warning])]
      : section.warnings.filter(item => !item.includes('Fikir belgesi'))
  }
  next = alignPlanToIdeaRevision(next, currentRevision)
  const recalculated = recalculateReadiness(next)
  const versioned = captureCurrentRevision(
    recalculated,
    `Canonical plan fikir belgesi r${currentRevision.number} ile hizalandı`
  )
  return { success: true, project: versioned, reason: '' }
}
