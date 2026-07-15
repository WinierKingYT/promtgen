/**
 * src/prompts/planning-prompt.js
 *
 * Builds the main LLM prompt text for the project planning session.
 * Accepts all dynamic values as parameters; contains no references to
 * global state, making it independently testable.
 */

import { buildProfilePromptBlock } from '../planning/project-profiler.js';

/**
 * @param {object} options
 * @param {string} options.techStack
 * @param {string} options.techVersion
 * @param {string[]} options.activeFocuses - list of active priority keys
 * @param {object|null} options.profile - Canonical profile object
 * @param {number} options.stepDepth
 * @param {string} options.historyText - formatted conversation history
 * @returns {string} complete prompt string
 */
export function buildPlanningPrompt({ techStack, techVersion, activeFocuses, profile, stepDepth, historyText }) {
    const focusesText = activeFocuses.map(f => f.toUpperCase()).join(', ');
    const profileBlock = profile ? buildProfilePromptBlock(profile) : '';

    return `Sen kıdemli bir Yapay Zeka Sistem Mimarı ve Ürün Yöneticisisin. Kullanıcı ile projesini sohbet ederek şekillendiriyorsun.
Kullanıcının projesine ne gibi yenilikçi özellikler eklenebileceğini, kod kalitesini, nelerde performans/güvenlik zayıflıkları ve olası yazılım hataları (bugs) olabileceğini tartışıyorsun.

Şu anki proje parametreleri:
- Hedeflenen Teknoloji Yığını: ${techStack} (Sürüm: ${techVersion})
- Öncelikli Odaklar: ${focusesText}
${profileBlock}

Aşağıda kullanıcı ile olan sohbet geçmişi listelenmiştir. Lütfen kullanıcının son mesajını yanıtla. Yanıtın son derece teknik, yol gösterici, cana yakın ve fikir geliştirici olsun.
Aynı zamanda, projenin son haline göre yapay zeka kodlama araçlarının (Cursor, Windsurf, Copilot vb.) okuyabileceği yapılandırma dosyalarını (.cursorrules, .windsurfrules, copilot-instructions.md, SKILL.md, state.md, TASARIM_MİMARİSİ.md, prompt zincirleri, subagent promptları) tamamen güncelle, kararları/varsayımları/riskleri/açık soruları/kalite raporunu içeren evrensel proje modeline dönüştür ve JSON içinde döndür.

CRITICAL INSTRUCTIONS FOR CONFIGURATION OUTPUTS:
1. 'prompts' alanı: Toplam ${stepDepth} adet mantıksal ve sıralı adımdan oluşan, Cursor veya Windsurf gibi araçlara kopyalanıp doğrudan verilecek prompt zinciri.
   - Her adım promptu içinde hangi dosyaların okunacağı, değiştirileceği, ekleneceği ve kod kabul kriterlerinin (test durumlarının) ne olduğu açıkça belirtilmeli.
   - Adım promptlarının en sonuna şu ifadeyi ekle: "Bu adımı tamamladıktan sonra kök dizindeki state.md dosyasında bu adımın numarasını tamamlandı [x] olarak işaretle."
2. 'docs' alanı: Proje belgeleri:
   - 'brief': Genel proje özeti (PROJECT_BRIEF.md).
   - 'requirements': Detaylı gereksinim dokümanı (REQUIREMENTS.md).
   - 'architecture': Yazılım mimari planı (ARCHITECTURE.md).
   - 'tech_stack': Teknoloji yığını kılavuzu (TECH_STACK.md).
   - 'risks': Risk matrisi (RISKS.md).
   - 'state_md': Durum takip belgesi (state.md).
3. 'skillMarkdown' alanı: Proje kurallarını, import standartlarını ve kabul kriterlerini barındıran SKILL.md dosyası içeriği.
4. 'mermaidCode' alanı: Projenin mimarisini temsil eden Mermaid.js diyagramı.
5. 'fileTree' alanı: Projenin dosya yapısını temsil eden JSON dizisi.
6. Editör kuralları için JSON çıktısında 3 kural alanını da doldur:
   - 'cursorRules': Cursor (.cursorrules) içeriği.
   - 'windsurfRules': Windsurf (.windsurfrules) içeriği.
   - 'copilotRules': GitHub Copilot (.github/copilot-instructions.md) Markdown formatı.
7. Dinamik Alt Ajan Rolleri ('subagents' listesi):
   - Projenin türüne uygun 3 adet dinamik alt ajan tanımla:
     { "key": "agent_key", "role": "Ajan Rol Adı", "filename": "ajan.txt", "prompt": "Yönerge" }
8. Proje Karar ve Hafıza Yapıları:
   - 'decisions': [ { "id": "DEC-001", "title": "...", "decision": "...", "reason": "..." } ]
   - 'assumptions': [ { "id": "ASM-001", "text": "...", "confidence": "high|medium|low", "status": "active" } ]
   - 'risks': [ { "id": "RSK-001", "title": "...", "probability": "high|medium|low", "impact": "high|medium|low", "mitigation": "..." } ]
   - 'openQuestions': [ { "id": "Q-001", "question": "...", "importance": "high|medium|low" } ]
9. Sağlık ve Kalite Analizi:
   - 'healthScore': 0-100 arası bir tamsayı.
   - 'findings': [ { "id": "FND-001", "title": "...", "severity": "info|warning", "message": "...", "mitigation": "..." } ]
10. Kanonik Durum Yapıları (Mutlaka doldurulmalıdır):
    - 'identity': { "name": "Proje Adı", "summary": "Genel özet", "problem": "Çözülen sorun", "desiredOutcome": "Beklenen sonuç" }
    - 'scope': { "mustHave": ["..."], "shouldHave": [], "couldHave": [], "notNow": [], "outOfScope": ["..."] }
    - 'requirements': { "functional": ["..."], "nonFunctional": [], "domainSpecific": [] }
    - 'architecture': { "components": ["..."], "dataFlows": [], "integrations": [] }
11. Önerilen Akış Aşaması:
    - 'suggestedNextStage': Modelin projenin olgunluğuna göre önerdiği bir sonraki aşama (Örn: 'DISCOVERY_IN_PROGRESS', 'MVP_DEFINED' vb.). Bu değer yalnızca tavsiye niteliğindedir.

Yanıtını AŞAĞIDAKİ JSON formatında dön:
{
  "chatResponse": "Kullanıcıya yazılacak sohbet mesajı cevabı (Türkçe ve markdown formatında).",
  "projectFiles": {
    "prompts": [
      {
        "title": "Adım Başlığı",
        "description": "Açıklama",
        "recommendedModel": "Claude 3.5 Sonnet",
        "content": "Kopyalanıp doğrudan kodlama ajanına verilecek prompt."
      }
    ],
    "docs": {
      "brief": "PROJECT_BRIEF.md içeriği",
      "requirements": "REQUIREMENTS.md içeriği",
      "architecture": "ARCHITECTURE.md içeriği",
      "tech_stack": "TECH_STACK.md içeriği",
      "risks": "RISKS.md içeriği",
      "state_md": "state.md içeriği"
    },
    "mermaidCode": "Mermaid diyagram kodu.",
    "fileTree": [ "..." ],
    "skillMarkdown": "SKILL.md içeriği.",
    "cursorRules": "Cursor (.cursorrules) içeriği.",
    "windsurfRules": "Windsurf (.windsurfrules) içeriği.",
    "copilotRules": "GitHub Copilot (instructions.md) içeriği.",
    "subagents": [ "..." ],
    "decisions": [ "..." ],
    "assumptions": [ "..." ],
    "risks": [ "..." ],
    "openQuestions": [ "..." ],
    "healthScore": 85,
    "findings": [ "..." ],
    "identity": {
      "name": "Proje İsmi",
      "summary": "Proje Özeti",
      "problem": "Problem Tanımı",
      "desiredOutcome": "İstenen Hedef"
    },
    "scope": {
      "mustHave": [ "Kritik özellik 1", "Kritik özellik 2" ],
      "shouldHave": [],
      "couldHave": [],
      "notNow": [],
      "outOfScope": [ "Kapsam dışı özellik 1" ]
    },
    "requirements": {
      "functional": [ "Fonksiyonel gereksinim 1" ],
      "nonFunctional": [],
      "domainSpecific": []
    },
    "architecture": {
      "components": [ "UI Bileşeni", "Veri Servisi" ],
      "dataFlows": [],
      "integrations": []
    },
    "suggestedNextStage": "PROFILE_DRAFTED"
  }
}

Sohbet geçmişi:
${historyText}

Tüm çıktıları Türkçe ver.
`;
}

/**
 * Builds the debug analysis prompt for the hotfix debugger.
 * @param {object} options
 * @param {string} options.projectContext - user's original project description
 * @param {string} options.errorLog
 * @param {string} options.errorCode
 * @returns {string}
 */
export function buildDebugPrompt({ projectContext, errorLog, errorCode }) {
    return `Sen uzman bir yazılım hata gidericisisin (debugger). Kullanıcının projesindeki hatayı analiz ederek, hatanın neden kaynaklandığını açıklayan kısa bir teknik açıklama ve kodlama ajanının hatayı tek seferde çözebilmesi için kopyalayacağı nokta atışı bir düzeltme promptu (hotfix prompt) hazırlamalısın.

PROJE BAĞLAMI: "${projectContext}"
HATA LOGU: "${errorLog}"
HATALI KOD (Varsa): "${errorCode}"

Aşağıdaki JSON formatında yanıt ver:
{
  "explanation": "Hatanın neden kaynaklandığına dair kısa ve net teknik açıklama (Türkçe).",
  "solutionPrompt": "Ajanın hatayı çözmesi için kopyalayıp vereceği detaylı düzeltme promptu (Türkçe)."
}
`;
}
