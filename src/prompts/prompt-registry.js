import { STAGE_CONTRACTS } from '../workflow/stage-contracts.js';
import { WORKFLOW_STAGES } from '../workflow/stages.js';
import { buildProfilePromptBlock } from '../planning/project-profiler.js';

/**
 * Builds the stage-specific planning prompt for the active workflow stage.
 * Uses unified stage contracts for templates, instructions, roles, and schema rules.
 * 
 * @param {object} options
 * @param {string} options.stage
 * @param {string} options.techStack
 * @param {string} options.techVersion
 * @param {string[]} options.activeFocuses
 * @param {object|null} options.profile
 * @param {number} options.stepDepth
 * @param {string} options.historyText
 * @returns {string} stage-specific prompt
 */
export function buildStageSpecificPrompt({ stage, techStack, techVersion, activeFocuses, profile, stepDepth, historyText }) {
    const stageInfo = STAGE_CONTRACTS[stage] || STAGE_CONTRACTS[WORKFLOW_STAGES.IDEA_CAPTURED];
    const focusesText = activeFocuses.map(f => f.toUpperCase()).join(', ');
    const profileBlock = profile ? buildProfilePromptBlock(profile) : '';

    return `Sen kıdemli bir Yapay Zeka Sistem Mimarı ve Ürün Yöneticisisin. Kullanıcı ile projesini sohbet ederek aşama aşama şekillendiriyorsun.
Şu anki Rolün: ${stageInfo.role}
Aktif Aşamamız: ${stage}

Görevin:
${stageInfo.instructions}

Şu anki proje parametreleri:
- Hedeflenen Teknoloji Yığını: ${techStack} (Sürüm: ${techVersion})
- Öncelikli Odaklar: ${focusesText}
- Planlama Adım Derinliği: ${stepDepth} adım
${profileBlock}

Sohbet Geçmişi:
${historyText}

Lütfen kullanıcının son mesajını yanıtla. Yanıtın son derece teknik, yol gösterici ve cana yakın olsun.
Aynı zamanda, mevcut aşamada planlanan verileri güncellemek için JSON içinde proposedPatches alanını doldur.
Bu aşamada sadece şu alanlara odaklanmalısın: ${stageInfo.focusFields}

CRITICAL PATCH PROPOSAL INSTRUCTIONS:
1. 'proposedPatches' alanı: RFC 6902 standardına uygun JSON Patch dizisi olmalıdır.
   - Her patch nesnesi: { "operation": "add|replace|remove", "path": "/path/to/field", "value": ..., "reason": "Değişikliğin teknik gerekçesi" } formatında olmalıdır.
   - Path örnekleri: '/identity/name', '/scope/mustHave', '/requirements/functional', '/architecture/components', '/decisions', '/assumptions', '/risks', '/openQuestions', '/agentPackage/subagents', '/agentPackage/rules/cursor'.
   - ${stageInfo.schemaNotes}
2. Önerdiğin tüm değişikliklerin gerekçelerini (reason) teknik ve açık yaz.
3. 'suggestedNextStage' alanı: Eğer bu aşamadaki tüm verilerin eksiksiz doldurulduğunu ve kullanıcının onaylamaya hazır olduğunu düşünüyorsan, bir sonraki önerilen aşamayı yaz (Örn: 'MVP_DEFINED'). Aksi takdirde boş bırak veya mevcut aşamayı yaz.

Yanıtını AŞAĞIDAKİ JSON formatında dön:
{
  "chatResponse": "Kullanıcıya yazılacak sohbet mesajı cevabı (Türkçe ve markdown formatında).",
  "projectFiles": {
    "proposedPatches": [
      {
        "operation": "add|replace|remove",
        "path": "/scope/mustHave",
        "value": ["Giriş Ekranı", "Veritabanı Entegrasyonu"],
        "reason": "MVP için asgari özellikler"
      }
    ],
    "suggestedNextStage": "..."
  }
}

Tüm çıktıları Türkçe ver.
`;
}
