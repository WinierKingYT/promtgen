/**
 * Bir komutun canonical planı değiştirip değiştirmediği tek yerde tanımlanır.
 *
 * Liste yalnız UI'da yaşarsa yeni bir komut eklendiğinde sessizce dışarıda
 * kalır: canonical revision hiç olmayan bir plan değişikliği için artar,
 * commandLog'a gerçekleşmemiş bir canonical değişiklik yazılır ve sonraki
 * apply'lar kendi sürüm bilgisini eskimiş sanıp reddedilir. Politika burada
 * durur ki hem UI hem testler aynı kaynağı okusun.
 *
 * Buradaki komutlar yalnız belgeyi (tartışma, öneri, taslak, oturum kaydı)
 * değiştirir; plana geçiş mevcut onay kapılarından geçer.
 */
export const DOCUMENT_ONLY_COMMANDS: ReadonlySet<string> = new Set([
  'AddDiscoveryTurn', 'UpdateSuggestionStatus', 'AddExpansionCard', 'ProposeChangeImpact',
  'ResolveImpactContradiction',
  'RejectChangeImpact', 'CreatePlanningScenario', 'DiscardPlanningScenario', 'SelectPlanningScenario',
  'GenerateSectionPatches', 'UpdateSectionPatchStatus', 'MarkSectionPatchesStale', 'UpdateIdeaDiscussion',
  'UpdateConceptAgreement', 'GenerateRequirementDrafts', 'UpdateRequirementDraft', 'RemoveRequirementDraft',
  'RestoreIdeaDocumentRevision',
  'ProposeIdeaAlignmentImpact', 'DeferPlanAlignment', 'RestoreAlignedIdeaRevision',
  'CreatePlanCodeAlignmentSuggestion',
  'StartExecutionSession', 'RecordExecutionResult', 'RecordExport', 'UpdateProject'
]);

/** Komut canonical revision'ı ilerletmeli mi? Bilinmeyen komut güvenli tarafta kalır: ilerletir. */
export function isCanonicalChangeCommand(commandType: string): boolean {
  return !DOCUMENT_ONLY_COMMANDS.has(commandType);
}
