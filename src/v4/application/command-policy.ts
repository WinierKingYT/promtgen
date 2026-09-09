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
  'StartExecutionSession', 'RecordExecutionResult', 'RecordExport', 'UpdateProject',
  // --- Ürün Modeli V3 aşama komutları ---
  // Bunlar aşama belgesini değiştirir ama canonical PLANI değiştirmez: plan
  // yalnız iki onaydan sonra `ConfirmIdeaPlanConversion` ile üretilir.
  //
  // `RunSolutionDiscovery` tam olarak `AddDiscoveryTurn`'ün teknik karşılığı:
  // ikisi de öneri üretir, ikisi de karar üretmez. Farklı sınıflandırmak aynı
  // eylemi iki farklı şey saymak olurdu.
  //
  // `GenerateArchitectureComparison` aynı sınıfın en zayıf üyesi: bir ŞABLON
  // yazar (`ideaLabSession.approaches`), üstelik proje verisinden türetilmeyen
  // bir şablon (bkz. capability-registry.ts `architecture-comparator-template`).
  // Canonical revision'ı ilerletmesi, hiç okunmamış hazır bir metnin planı
  // değiştirdiğini iddia etmek olurdu.
  'RunSolutionDiscovery', 'GenerateArchitectureComparison', 'ConfirmProjectFraming',
  'DeferConcern', 'DismissConcern', 'DeclineTechnologyCandidate',
  // `RunIdeaConcernDiscovery`, `AddDiscoveryTurn` ile AYNI şeyi yazar: ikisi
  // de aynı `discovery` görevinin paketini `concernsFromBundle` üzerinden
  // `ideaDesign.concerns`e çevirir. Tek fark giriş kapısı — biri sohbet turu,
  // öbürü keşif panosundaki eylem. Konu bir SORUDUR, karar değil: eklenen
  // konuların durumu `open`dır, bu yüzden `usesStageModel` bile kıpırdamaz
  // (ölçüldü) ve canonical plan yalnız iki onaydan sonra
  // `ConfirmIdeaPlanConversion` ile üretilir. Farklı sınıflandırmak, aynı
  // yazımı iki farklı şey saymak olurdu.
  'RunIdeaConcernDiscovery'
]);

/**
 * Canonical planı **gerçekten** değiştiren V3 komutları.
 *
 * Ayrı bir liste tutmanın sebebi çalışma zamanı değil denetim:
 * `isCanonicalChangeCommand` bilinmeyen komutu zaten güvenli tarafta sayıyor,
 * ama "güvenli varsayılan" sınıflandırma yerine geçerse yeni komutlar sessizce
 * canonical sayılır. Bu oturumda tam olarak bu oldu: on yeni komut eklendi,
 * hiçbiri sınıflandırılmadı ve beşi yanlış tarafta kaldı.
 */
export const CANONICAL_CHANGE_COMMANDS: ReadonlySet<string> = new Set([
  'AnswerConcern',
  'AcceptTechnologyCandidate',
  'ApproveIdeaDesign',
  'ApproveSolutionDesign',
  'ReopenIdeaApproval',
  'ReopenSolutionApproval',
  // Bir gereksinimin kabulü canonical bir karardır: durumu `accepted` yapar,
  // ifadeyi `sections.requirements.items` içine yazar ve hedefe iz bağı kurar
  // (`acceptRequirementDraft`). Kardeşleri `UpdateRequirementDraft` /
  // `RemoveRequirementDraft` belge-içidir çünkü onlar yalnız TASLAĞA dokunur.
  'AcceptRequirementDraft',
  'ApplyApprovedChanges', 'ApplyTaskPlan', 'ConfirmIdeaPlanConversion',
  'FinalizePlan', 'ReopenPlan', 'RestoreRevision',
  // V3 ÖNCESİNDEN gelen ve hiç sınıflandırılmamış olanlar. Beşi de canonical
  // planı değiştiriyor, yani "bilinmeyen komut canonical sayılır" varsayılanı
  // zaten doğru cevabı veriyordu. Buraya yazmak davranışı DEĞİŞTİRMİYOR,
  // yalnız kayda geçiriyor — bir hijyen taraması sırasında sessizce davranış
  // değiştirmek, düzeltmeye çalıştığı sorundan kötüsü olurdu.
  'UpdatePlanSection', 'ApplySectionPatches',
  'RestoreCheckpoint', 'ImportPackage', 'RestorePackage'
]);

/** Komut açıkça sınıflandırılmış mı? Sınıflandırılmamış komut bir eksiktir. */
export function isClassifiedCommand(commandType: string): boolean {
  return DOCUMENT_ONLY_COMMANDS.has(commandType) || CANONICAL_CHANGE_COMMANDS.has(commandType);
}

/** Komut canonical revision'ı ilerletmeli mi? Bilinmeyen komut güvenli tarafta kalır: ilerletir. */
export function isCanonicalChangeCommand(commandType: string): boolean {
  return !DOCUMENT_ONLY_COMMANDS.has(commandType);
}
