# Modül Erişilebilirliği

`src/v4/application` katmanındaki dışa aktarımların üretim kodundan gerçekten
çağrılıp çağrılmadığı. `npm run check:reachability` bunu zorlar.

- Toplam dışa aktarım: **210**
- Üretimden erişilebilir: **180**
- Yalnız kendi modülünde kullanılan: **18**
- Üretimde hiç çağrılmayan: **12**

## Neden var

"Soyutlamayı doğru kur, bağlantıyı eksik bırak" hatası birim testleriyle
görünmez: modül kendi içinde test edilir ve yeşil verir. Onu yakalayan tek şey
çağrı yeri saymaktır.

## Üretimde çağrılmayanlar

Bunlar testlerden çağrılıyor ama üründe karşılığı yok. Her biri ya bağlanmalı
ya silinmeli; listenin **büyümesi** kapıyı düşürür.

- `change-impact-service.ts::applyChangeImpact`
- `change-impact-service.ts::rejectChangeImpact`
- `change-impact-service.ts::resolveImpactContradiction`
- `command-policy.ts::isClassifiedCommand`
- `discovery-answer-service.ts::updateDiscoveryAnswerPatch`
- `idea-discussion-service.ts::setIdeaDiscussionMode`
- `idea-discussion-service.ts::updateIdeaRecord`
- `idea-expansion-service.ts::clearExpansionCache`
- `idea-guide-service.ts::buildAnonymousStudySession`
- `idea-maturity-service.ts::assessIdeaMaturity`
- `implementation-evidence-service.ts::decideImplementationEvidence`
- `provider-readiness-service.ts::providerRecoveryHint`

## Yalnız kendi modülünde kullanılanlar

Kod canlı; dışa aktarım gereksiz olabilir. Kapıyı düşürmez, bilgi amaçlıdır.

- `canonical-document-export.ts::IDEA_DOCUMENT_PATH`
- `command-policy.ts::CANONICAL_CHANGE_COMMANDS`
- `command-policy.ts::DOCUMENT_ONLY_COMMANDS`
- `concerns.ts::concernPriority`
- `concerns.ts::isAskable`
- `conversion-v2.ts::conversionSources`
- `expansion-card-tone.ts::hasCommandTone`
- `expansion-card-tone.ts::hasTaskToneTitle`
- `idea-document-revision-service.ts::snapshotIdeaDocument`
- `implementation-evidence-format.ts::IMPLEMENTATION_EVIDENCE_FORMAT`
- `implementation-evidence-format.ts::IMPLEMENTATION_EVIDENCE_FORMAT_VERSION`
- `implementation-evidence-format.ts::MAX_IMPLEMENTATION_EVIDENCE_BYTES`
- `legacy-scope-defaults.ts::REMOVED_SCOPE_DEFAULTS`
- `legacy-scope-defaults.ts::isRemovedScopeDefault`
- `planning-scenario-service.ts::comparePlanningScenario`
- `proposal-bundle-selectors.ts::EXPANSION_BUNDLE_ID_PREFIX`
- `stage-migration.ts::classifyLegacyDecision`
- `stage-migration.ts::framingFromLegacy`
