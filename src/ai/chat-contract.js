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
  "proposedDecisions": [],
  "proposedTraceLinks": [],
  "proposedArtifacts": [],
  "proposedTasks": [],
  "suggestedActions": [],
  "suggestedPhaseTransition": null
}

KURALLAR:
- proposedPatches dizisi RFC 6902 JSON Patch formatında olmalı
- operation: "add" | "replace" | "remove"
- path: "/" ile başlayan JSON path (örn: /identity/name, /objectives/-, /decisions/-)
- Her patch'in bir id ve reason alanı olmalı
- Sadece geçerli aşamada değiştirilmesine izin verilen alanları değiştir
- conversationResponse.text kullanıcıya ne yapıldığını açıklamalı`;
}
