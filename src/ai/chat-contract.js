export function createEmptyResponse() {
    return {
        conversationResponse: { text: '', actions: [] },
        proposedPatches: [],
        proposedDecisions: [],
        proposedTraceLinks: [],
        proposedArtifacts: [],
        proposedTasks: [],
        suggestedActions: [],
        suggestedPhaseTransition: null,
        _legacy: null
    };
}

export function normalizeAIResponse(raw) {
    if (!raw || typeof raw !== 'object') return createEmptyResponse();

    if (raw.conversationResponse && Array.isArray(raw.proposedPatches)) {
        return {
            conversationResponse: {
                text: raw.conversationResponse.text || raw.conversationResponse,
                actions: raw.conversationResponse.actions || []
            },
            proposedPatches: raw.proposedPatches,
            proposedDecisions: raw.proposedDecisions || [],
            proposedTraceLinks: raw.proposedTraceLinks || [],
            proposedArtifacts: raw.proposedArtifacts || [],
            proposedTasks: raw.proposedTasks || [],
            suggestedActions: raw.suggestedActions || [],
            suggestedPhaseTransition: raw.suggestedPhaseTransition || null,
            _legacy: null
        };
    }

    if (raw.chatResponse && raw.projectFiles) {
        const pf = raw.projectFiles || {};
        return {
            conversationResponse: { text: raw.chatResponse, actions: [] },
            proposedPatches: pf.proposedPatches || [],
            proposedDecisions: pf.proposedDecisions || [],
            proposedTraceLinks: [],
            proposedArtifacts: [],
            proposedTasks: [],
            suggestedActions: [],
            suggestedPhaseTransition: pf.suggestedNextStage || null,
            _legacy: { chatResponse: raw.chatResponse, projectFiles: pf }
        };
    }

    const out = createEmptyResponse();
    if (typeof raw === 'string') out.conversationResponse.text = raw;
    else if (raw.text) out.conversationResponse.text = raw.text;
    return out;
}

export function buildV3ProposalPrompt(context) {
    const { stage, techStack, techVersion, activeFocuses, profile, stepDepth, historyText } = context;
    return `Sen bir Evrensel Proje Mimarısın (Universal Project Architect).

MEVCUT DURUM:
- Aşama: ${stage}
- Teknoloji: ${techStack} (${techVersion})
- Odaklar: ${activeFocuses.join(', ') || 'Genel'}
- Plan derinliği: ${stepDepth} adım
${profile ? `- Domain: ${profile.domains.map(d => d.name).join(', ')}` : ''}

KONUŞMA GEÇMİŞİ:
${historyText}

GÖREV:
Yukarıdaki konuşma bağlamına göre projede yapılması gereken değişiklikleri JSON olarak döndür.

YANIT FORMATI (sadece JSON):
{
  "conversationResponse": {
    "text": "Kullanıcıya dönük doğal dil yanıtı. Ne yapıldığını ve hangi değişikliklerin önerildiğini anlat.",
    "actions": []
  },
  "proposedPatches": [
    {
      "id": "PATCH-001",
      "operation": "add",
      "path": "/objectives/-",
      "value": { "id": "OBJ-1", "title": "Örnek hedef", "text": "Hedef açıklaması" },
      "reason": "Neden bu değişiklik öneriliyor"
    }
  ],
  "proposedDecisions": [
    { "id": "DEC-001", "title": "Karar başlığı", "decision": "Alınan karar", "reason": "Karar gerekçesi" }
  ],
  "proposedTraceLinks": [
    { "source": "OBJ-1", "target": "DEC-001", "type": "implements" }
  ],
  "proposedArtifacts": [
    { "id": "ART-001", "title": "Çıktı adı", "type": "documentation" }
  ],
  "proposedTasks": [
    { "id": "TASK-001", "title": "Görev adı", "acceptanceCriteria": ["Kriter 1", "Kriter 2"] }
  ],
  "suggestedActions": [
    { "id": "ACT-001", "action": "review", "title": "Gözden geçirme", "description": "Önerilen eylem" }
  ],
  "suggestedPhaseTransition": null
}

KURALLAR:
- proposedPatches dizisi RFC 6902 JSON Patch formatında olmalı
- operation: "add" | "replace" | "remove"
- path: "/" ile başlayan JSON path (örn: /identity/name, /objectives/-, /decisions/-)
- Her patch'in bir id ve reason alanı olmalı
- Sadece geçerli aşamada değiştirilmesine izin verilen alanları değiştir
- conversationResponse.text kullanıcıya ne yapıldığını açıklamalı

PROPOSAL ITEM FORMATLARI:
- proposedDecisions[]: Her karar { id, title, decision, reason, options[]?, status? } içermeli.
  id ve title zorunlu. decision karar metni, reason gerekçe - ikisi de zorunlu.
- proposedArtifacts[]: Her çıktı { id, title, type?, content? } içermeli. id ve title zorunlu.
- proposedTasks[]: Her görev { id, title, acceptanceCriteria[]|string, status?, priority? } içermeli.
  id, title ve acceptanceCriteria zorunlu. acceptanceCriteria dizi veya metin olabilir.
- proposedTraceLinks[]: Her link { source, target, type? } içermeli. source ve target zorunlu.
  type yoksa varsayılan "implements" kullanılır.
- suggestedActions[]: Her eylem { id, action|title, description? } içermeli. id ve action/title zorunlu.
- suggestedPhaseTransition: null veya geçerli bir sonraki aşama adı (string).`;

}
