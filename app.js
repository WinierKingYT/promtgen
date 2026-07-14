import { GoogleGenerativeAI } from 'https://esm.run/@google/generative-ai';

// --- APPLICATION STATE & DEFAULTS ---
const DEFAULTS = {
    apiKey: '',
    projectType: 'web',
    priorities: {
        ui: true,
        security: true,
        performance: true,
        scale: true
    },
    techStack: 'React, TypeScript, CSS',
    techVersion: 'latest',
    stepDepth: 5,
    activeEditor: 'cursor'
};

let state = {
    apiKey: localStorage.getItem('ai_arch_api_key') || '',
    projectType: DEFAULTS.projectType,
    priorities: { ...DEFAULTS.priorities },
    techStack: DEFAULTS.techStack,
    techVersion: DEFAULTS.techVersion,
    stepDepth: DEFAULTS.stepDepth,
    activeEditor: DEFAULTS.activeEditor,
    
    // Chat state
    chatStarted: false,
    projectId: null,
    draftDescription: '',
    messages: [], // Array of { role: 'user'|'model', content: string, fileMeta?: object, hiddenContext?: boolean }
    
    // Config outputs data
    currentData: null,
    activeSubagentKey: 'frontend',
    
    // History stack for Undo
    historyStack: [] // Array of { messages: [], currentData: {} }
};

function escapeHTML(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

class LLMProvider {
    static async generateContent(promptText, apiKey, isJson = false) {
        if (!apiKey) throw new Error("API Key is required.");
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: isJson ? { responseMimeType: "application/json" } : {}
        });
        const result = await model.generateContent(promptText);
        return result.response.text();
    }
}

// --- DOM ELEMENTS ---
const elements = {
    btnOpenSettings: document.getElementById('btn-open-settings'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    btnCancelSettings: document.getElementById('btn-cancel-settings'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
    modalSettings: document.getElementById('modal-settings'),
    apiKeyInput: document.getElementById('api-key-input'),
    btnTogglePassword: document.getElementById('btn-toggle-password'),
    apiStatusBadge: document.getElementById('api-status-badge'),
    
    // View layouts
    setupHeader: document.getElementById('setup-header'),
    chatHeader: document.getElementById('chat-header'),
    setupView: document.getElementById('setup-view'),
    chatView: document.getElementById('chat-view'),
    
    // Previous Projects grid
    previousProjectsSection: document.getElementById('previous-projects-section'),
    previousProjectsGrid: document.getElementById('previous-projects-grid'),

    // Setup fields
    projectTypes: document.querySelectorAll('.type-btn'),
    priorityCheckboxes: document.querySelectorAll('.priority-checkbox input'),
    techStackInput: document.getElementById('tech-stack-input'),
    techVersionSelect: document.getElementById('tech-version-select'),
    depthBtns: document.querySelectorAll('.depth-btn'),
    projectDescription: document.getElementById('project-description'),
    btnStartChat: document.getElementById('btn-start-chat'),
    templates: document.querySelectorAll('.template-card'),

    // Chat fields
    chatMessagesContainer: document.getElementById('chat-messages-container'),
    chatTypingIndicator: document.getElementById('chat-typing-indicator'),
    chatInputTextarea: document.getElementById('chat-input-textarea'),
    btnSendChat: document.getElementById('btn-send-chat'),
    btnResetChat: document.getElementById('btn-reset-chat'),
    btnUndoChat: document.getElementById('btn-undo-chat'),
    chatProjectStatus: document.getElementById('chat-project-status'),
    btnAttachFile: document.getElementById('btn-attach-file'),
    chatFileInput: document.getElementById('chat-file-input'),

    // Outputs tabs
    outputPanel: document.getElementById('output-panel'),
    emptyState: document.getElementById('output-empty-state'),
    loadingState: document.getElementById('output-loading-state'),
    loadingTitle: document.getElementById('loading-title'),
    loadingStepText: document.getElementById('loading-step-text'),
    contentState: document.getElementById('output-content-state'),
    
    tabs: document.querySelectorAll('.tab-btn'),
    panels: document.querySelectorAll('.tab-panel'),
    
    // Tab 1: Pipeline
    pipelineList: document.getElementById('prompt-pipeline-list'),
    btnCopyAll: document.getElementById('btn-copy-all'),
    btnDownloadZip: document.getElementById('btn-download-zip'),
    
    // Tab 2: SKILL.md
    skillCode: document.getElementById('skill-content-code'),
    btnCopySkill: document.getElementById('btn-copy-skill'),
    btnDownloadSkill: document.getElementById('btn-download-skill'),
    skillCheckboxes: document.querySelectorAll('.skill-customizer input'),
    // Tab 3: Editor Rules (.cursorrules / .windsurfrules / copilot-instructions.md) & Subagents
    rulesBtns: document.querySelectorAll('#panel-cursor .rules-btn'),
    cursorFilename: document.getElementById('cursor-filename'),
    cursorCode: document.getElementById('cursor-content-code'),
    btnCopyCursor: document.getElementById('btn-copy-cursor'),
    btnDownloadCursor: document.getElementById('btn-download-cursor'),
    btnDownloadCursorText: document.getElementById('btn-download-cursor-text'),
    subagentCode: document.getElementById('subagent-content-code'),
    subagentFilename: document.getElementById('subagent-filename'),
    btnCopySubagent: document.getElementById('btn-copy-subagent'),
    subagentSelectorContainer: document.getElementById('subagent-selector-container'),

    // Tab 4: Proje Belgeleri (brief, requirements, architecture, tech_stack, risks, state_md)
    btnCopyDoc: document.getElementById('btn-copy-doc'),
    btnDownloadDoc: document.getElementById('btn-download-doc'),
    btnDownloadDocText: document.getElementById('btn-download-doc-text'),
    docFilename: document.getElementById('doc-filename'),
    docCode: document.getElementById('doc-content-code'),
    projectDocsSelector: document.getElementById('project-docs-selector'),

    // Tab 5: Interactive File Tree
    fileTreeContainer: document.getElementById('file-tree-interactive-container'),
    btnAddFileTree: document.getElementById('btn-add-file-tree'),
    btnAddFolderTree: document.getElementById('btn-add-folder-tree'),

    // Tab 6: Proje Hafızası
    memoryDecisionsList: document.getElementById('memory-decisions-list'),
    memoryAssumptionsList: document.getElementById('memory-assumptions-list'),

    // Tab 7: Kalite, Sağlık Skoru & Hata Giderici
    healthScorePercentage: document.getElementById('health-score-percentage'),
    reviewerFindingsContainer: document.getElementById('reviewer-findings-container'),
    debuggerError: document.getElementById('debugger-error'),
    debuggerCode: document.getElementById('debugger-code'),
    btnSolveDebug: document.getElementById('btn-solve-debug'),
    debuggerSolutionSection: document.getElementById('debugger-solution-section'),
    debuggerExplanation: document.getElementById('debugger-explanation'),
    debuggerSolutionCode: document.getElementById('debugger-solution-code'),
    btnCopyDebugSolution: document.getElementById('btn-copy-debug-solution'),
    btnFeedDebug: document.getElementById('btn-feed-debug'),

    // Tab 8: Proje Analizörü
    analyserInputMeta: document.getElementById('analyser-input-meta'),
    btnRunAnalyser: document.getElementById('btn-run-analyser'),
    analyserOutputSection: document.getElementById('analyser-output-section'),
    analyserDetectionText: document.getElementById('analyser-detection-text'),
    analyserSolutionCode: document.getElementById('analyser-solution-code'),
    btnCopyAnalyser: document.getElementById('btn-copy-analyser'),
    
    toast: document.getElementById('toast')
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    if (window.lucide) {
        window.lucide.createIcons();
    }
    if (state.apiKey) {
        elements.apiKeyInput.value = state.apiKey;
    }
    updateApiStatusBadge();
    setupEventListeners();
    loadSavedProjectsList();
    toggleViews();
}

// --- API STATUS BADGE ---
function updateApiStatusBadge() {
    if (state.apiKey && state.apiKey.length > 10) {
        elements.apiStatusBadge.classList.add('active');
        elements.apiStatusBadge.querySelector('.status-text').textContent = 'API Modu Aktif';
    } else {
        elements.apiStatusBadge.classList.remove('active');
        elements.apiStatusBadge.querySelector('.status-text').textContent = 'Çevrimdışı Şablon Modu';
    }
}

// --- SWITCH LAYOUT VIEWS ---
function toggleViews() {
    if (state.chatStarted) {
        elements.setupHeader.classList.add('hidden');
        elements.setupView.classList.add('hidden');
        elements.chatHeader.classList.remove('hidden');
        elements.chatView.classList.remove('hidden');
        
        let typeText = 'Web Sitesi';
        if (state.projectType === 'mobile') typeText = 'Mobil Uygulama';
        if (state.projectType === 'game') typeText = 'Oyun Mekaniği';
        if (state.projectType === 'api') typeText = 'Backend / API';
        
        elements.chatProjectStatus.textContent = `${typeText} Projesi - Sohbet Aktif`;
        updateUndoButtonVisibility();
    } else {
        elements.chatHeader.classList.add('hidden');
        elements.chatView.classList.add('hidden');
        elements.setupHeader.classList.remove('hidden');
        elements.setupView.classList.remove('hidden');
        
        elements.emptyState.classList.remove('hidden');
        elements.contentState.classList.add('hidden');
        loadSavedProjectsList();
    }
}

// --- TOAST ALERTS ---
function showToast(message, isError = false) {
    elements.toast.classList.remove('hidden');
    elements.toast.querySelector('.toast-message').textContent = message;
    
    const icon = elements.toast.querySelector('.toast-icon');
    if (isError) {
        elements.toast.style.background = '#ef4444';
        elements.toast.style.boxShadow = '0 10px 25px rgba(239, 68, 68, 0.3)';
        icon.setAttribute('data-lucide', 'alert-triangle');
    } else {
        elements.toast.style.background = '#10b981';
        elements.toast.style.boxShadow = '0 10px 25px rgba(16, 185, 129, 0.3)';
        icon.setAttribute('data-lucide', 'check-circle');
    }
    
    if (window.lucide) window.lucide.createIcons();
    
    setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, 3000);
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    // API modal toggles
    elements.btnOpenSettings.addEventListener('click', () => {
        elements.apiKeyInput.value = state.apiKey || '';
        elements.modalSettings.classList.remove('hidden');
    });
    
    const closeModal = () => elements.modalSettings.classList.add('hidden');
    elements.btnCloseSettings.addEventListener('click', closeModal);
    elements.btnCancelSettings.addEventListener('click', closeModal);
    
    elements.btnSaveSettings.addEventListener('click', () => {
        const newKey = elements.apiKeyInput.value.trim();
        state.apiKey = newKey;
        if (newKey) {
            localStorage.setItem('ai_arch_api_key', newKey);
        } else {
            localStorage.removeItem('ai_arch_api_key');
        }
        updateApiStatusBadge();
        closeModal();
        showToast('Ayarlar kaydedildi!');
    });
    
    elements.btnTogglePassword.addEventListener('click', () => {
        const type = elements.apiKeyInput.type === 'password' ? 'text' : 'password';
        elements.apiKeyInput.type = type;
        const icon = elements.btnTogglePassword.querySelector('i');
        icon.setAttribute('data-lucide', type === 'text' ? 'eye-off' : 'eye');
        if (window.lucide) window.lucide.createIcons();
    });

    // Project Type selectors
    elements.projectTypes.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.projectTypes.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.projectType = btn.getAttribute('data-type');
        });
    });

    // Priorities checkboxes
    elements.priorityCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            const label = cb.closest('.priority-checkbox');
            const key = cb.id.replace('focus-', '');
            state.priorities[key] = cb.checked;
            
            if (cb.checked) {
                label.classList.add('active');
            } else {
                label.classList.remove('active');
            }
        });
    });

    // Tech Stack Input listener
    elements.techStackInput.addEventListener('input', () => {
        state.techStack = elements.techStackInput.value.trim() || DEFAULTS.techStack;
    });

    // Tech Version Selector listener
    elements.techVersionSelect.addEventListener('change', () => {
        state.techVersion = elements.techVersionSelect.value;
    });

    // Pipeline depth selectors
    elements.depthBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.depthBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.stepDepth = parseInt(btn.getAttribute('data-steps')) || 5;
            state.planningDepth = btn.getAttribute('data-depth') || 'standard';
        });
    });

    // Editor Rules selector
    elements.rulesBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.rulesBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeEditor = btn.getAttribute('data-editor');
            updateEditorRulesView();
        });
    });

    // File attachments trigger
    elements.btnAttachFile.addEventListener('click', () => {
        elements.chatFileInput.click();
    });
    elements.chatFileInput.addEventListener('change', handleChatFileUpload);

    // Dynamic Skill checklist customizer
    elements.skillCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            const label = cb.closest('.priority-checkbox');
            label.classList.toggle('active', cb.checked);
            if (state.currentData) {
                elements.skillCode.textContent = getFilteredSkillMarkdown();
            }
        });
    });

    // Templates
    elements.templates.forEach(card => {
        card.addEventListener('click', () => {
            const templateType = card.getAttribute('data-template');
            loadTemplate(templateType);
        });
    });

    // Start Chat
    elements.btnStartChat.addEventListener('click', handleStartChat);

    // Send Chat Message
    elements.btnSendChat.addEventListener('click', handleSendChatMessage);
    elements.chatInputTextarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendChatMessage();
        }
    });

    // Reset Chat Session & Undo Chat
    elements.btnResetChat.addEventListener('click', resetChatSession);
    elements.btnUndoChat.addEventListener('click', handleUndoChat);

    // Add elements to File Tree
    elements.btnAddFileTree.addEventListener('click', () => handleAddFileTreeItem('file'));
    elements.btnAddFolderTree.addEventListener('click', () => handleAddFileTreeItem('folder'));

    // Right Tab selectors
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            elements.tabs.forEach(t => t.classList.remove('active'));
            elements.panels.forEach(p => p.classList.remove('active'));
            
            tab.classList.add('active');
            const targetId = `panel-${tab.getAttribute('data-tab')}`;
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Bind Copy & Download events
    elements.btnCopyAll.addEventListener('click', copyAllPrompts);
    elements.btnCopySkill.addEventListener('click', copySkillFile);
    elements.btnDownloadSkill.addEventListener('click', downloadSkillFile);
    elements.btnCopyCursor.addEventListener('click', copyCursorFile);
    elements.btnDownloadCursor.addEventListener('click', downloadCursorFile);
    elements.btnCopySubagent.addEventListener('click', copySubagentFile);
    elements.btnCopyDebugSolution.addEventListener('click', copyDebugSolution);
    elements.btnSolveDebug.addEventListener('click', handleSolveDebug);
    
    // Bind Tab 4 docs copy & download & selector
    elements.projectDocsSelector.addEventListener('click', (e) => {
        const btn = e.target.closest('.rules-btn');
        if (!btn) return;
        
        const docBtns = elements.projectDocsSelector.querySelectorAll('.rules-btn');
        docBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeDocKey = btn.getAttribute('data-doc');
        updateProjectDocView();
    });
    elements.btnCopyDoc.addEventListener('click', () => {
        const text = getActiveDocText();
        if (text) {
            copyTextToClipboard(text);
            showToast(`${getActiveDocFilename()} kopyalandı!`);
        }
    });
    elements.btnDownloadDoc.addEventListener('click', () => {
        const text = getActiveDocText();
        const filename = getActiveDocFilename();
        if (text) {
            const blob = new Blob([text], { type: 'text/markdown;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            elements.setupView.appendChild(link);
            link.click();
            elements.setupView.removeChild(link);
            showToast(`${filename} indirildi!`);
        }
    });

    // Bind Tab 8 Proje Analizörü
    elements.btnRunAnalyser.addEventListener('click', handleRunAnalyser);
    elements.btnCopyAnalyser.addEventListener('click', copyAnalyserReport);

    // ZIP Download & Feedback buttons
    elements.btnDownloadZip.addEventListener('click', downloadAllAsZip);
    elements.btnFeedDebug.addEventListener('click', feedDebugToArchitect);
}

// --- QUICK TEMPLATE LOAD ---
function loadTemplate(type) {
    let description = '';
    let stack = '';
    let version = 'latest';
    
    if (type === 'web-saas') {
        description = "Kullanıcıların kendi verilerini takip edebileceği, grafikleri, filtreleme araçları olan, dark/light mod destekli, responsive bir Admin SaaS Dashboard paneli tasarlamak istiyorum. Veriler mock api üzerinden çekilecek, durum yönetimi lokal olarak tutulacak.";
        stack = "React, TypeScript, TailwindCSS, Chart.js";
        version = "react-19";
        setProjectType('web');
        setPriorities({ ui: true, security: true, performance: true, scale: true });
    } else if (type === 'mobile-budget') {
        description = "Kişisel finans ve bütçe yönetimi mobil uygulaması. Kullanıcılar gelir ve gider ekleyebilecek, kategorilere göre bütçe limiti koyabilecek. Veriler lokal veri tabanında şifreli saklanmalı. Çevrimdışı çalışabilmeli ve harcama grafiklerini görselleştirebilmeli.";
        stack = "Flutter, Dart, SQLite, Provider";
        version = "flutter-3";
        setProjectType('mobile');
        setPriorities({ ui: true, security: true, performance: true, scale: true });
    } else if (type === 'game-inventory') {
        description = "RPG oyunu için envanter ve crafting sistemi. Sürükle bırak desteği olmalı. Envanter kapasitesi sınırlı olmalı, eşya nadirliklerine göre renkli gösterilmeli. Crafting panelinde malzemeleri birleştirip yeni item üretebilmeli.";
        stack = "Unity, C#";
        version = "unity-6";
        setProjectType('game');
        setPriorities({ ui: true, security: false, performance: true, scale: true });
    }

    elements.projectDescription.value = description;
    elements.techStackInput.value = stack;
    elements.techVersionSelect.value = version;
    state.techStack = stack;
    state.techVersion = version;
    showToast('Şablon yüklendi!');
}

function setProjectType(type) {
    state.projectType = type;
    elements.projectTypes.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-type') === type);
    });
}

function setPriorities(priorities) {
    state.priorities = { ...priorities };
    elements.priorityCheckboxes.forEach(cb => {
        const key = cb.id.replace('focus-', '');
        cb.checked = !!priorities[key];
        const label = cb.closest('.priority-checkbox');
        label.classList.toggle('active', cb.checked);
    });
}

// --- LOCAL STORAGE: PROJECTS MANAGEMENT ---
function loadSavedProjectsList() {
    const projects = JSON.parse(localStorage.getItem('ai_arch_saved_projects')) || [];
    
    if (projects.length === 0) {
        elements.previousProjectsSection.classList.add('hidden');
        return;
    }

    elements.previousProjectsSection.classList.remove('hidden');
    elements.previousProjectsGrid.innerHTML = '';

    projects.forEach(proj => {
        const card = document.createElement('div');
        card.className = 'project-history-card';
        card.innerHTML = `
            <div class="project-history-info">
                <h4>${escapeHTML(proj.title)}</h4>
                <span>${escapeHTML(proj.date)} | ${escapeHTML(proj.projectType.toUpperCase())}</span>
            </div>
            <button class="btn-delete-project" data-id="${proj.id}" title="Sil">
                <i data-lucide="trash-2" style="width:14px; height:14px; margin-right:0;"></i>
            </button>
        `;

        card.addEventListener('click', () => loadProjectSession(proj.id));
        card.querySelector('.btn-delete-project').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteProjectSession(proj.id);
        });

        elements.previousProjectsGrid.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons();
}

function saveCurrentProjectState() {
    if (!state.chatStarted) return;
    
    let projects = [];
    try {
        projects = JSON.parse(localStorage.getItem('ai_arch_saved_projects')) || [];
    } catch (e) {
        console.error("Failed to parse projects list, resetting.", e);
        projects = [];
    }
    
    if (!state.projectId) {
        state.projectId = Date.now().toString();
    }

    const title = state.draftDescription.substring(0, 35) + (state.draftDescription.length > 35 ? '...' : '');
    const dateStr = new Date().toLocaleDateString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    // Track revisions (HIGH-003)
    let oldProject = projects.find(p => p.id === state.projectId) || {};
    let revisions = Array.isArray(oldProject.revisions) ? oldProject.revisions : [];
    
    if (state.currentData) {
        revisions.push({
            timestamp: Date.now(),
            date: dateStr,
            workflowStage: state.currentData.workflowStage || 'SCOPE_DRAFTED',
            healthScore: state.currentData.healthScore || 85,
            techStack: state.techStack
        });
        if (revisions.length > 15) {
            revisions.shift();
        }
    }

    const projectObj = {
        id: state.projectId,
        title: title,
        projectType: state.projectType,
        priorities: state.priorities,
        techStack: state.techStack,
        techVersion: state.techVersion || DEFAULTS.techVersion,
        stepDepth: state.stepDepth,
        draftDescription: state.draftDescription,
        messages: state.messages,
        currentData: state.currentData,
        date: dateStr,
        revisions: revisions
    };

    const index = projects.findIndex(p => p.id === state.projectId);
    if (index > -1) {
        projects[index] = projectObj;
    } else {
        projects.unshift(projectObj);
    }

    try {
        localStorage.setItem('ai_arch_saved_projects', JSON.stringify(projects));
    } catch (e) {
        console.error("localStorage capacity exceeded!", e);
        showToast("Hafıza doldu! Eski projeleri silerek alan açın.", true);
    }
}

function loadProjectSession(id) {
    let projects = [];
    try {
        projects = JSON.parse(localStorage.getItem('ai_arch_saved_projects')) || [];
    } catch (e) {
        console.error("Failed to parse projects list on load", e);
        return;
    }
    const proj = projects.find(p => p.id === id);
    if (!proj) return;

    state.projectId = proj.id;
    state.projectType = proj.projectType;
    state.priorities = proj.priorities || { ...DEFAULTS.priorities };
    state.techStack = proj.techStack || DEFAULTS.techStack;
    state.techVersion = proj.techVersion || DEFAULTS.techVersion;
    state.stepDepth = proj.stepDepth || DEFAULTS.stepDepth;
    state.draftDescription = proj.draftDescription;
    state.messages = Array.isArray(proj.messages) ? proj.messages : [];
    state.currentData = proj.currentData ? validateProjectData(proj.currentData) : null;
    state.chatStarted = true;
    
    state.historyStack = [{
        messages: JSON.parse(JSON.stringify(state.messages)),
        currentData: JSON.parse(JSON.stringify(state.currentData))
    }];

    // Restore UI Inputs
    setProjectType(state.projectType);
    setPriorities(state.priorities);
    elements.techStackInput.value = state.techStack;
    elements.techVersionSelect.value = state.techVersion;
    elements.projectDescription.value = state.draftDescription;

    elements.depthBtns.forEach(btn => {
        const depthAttr = btn.getAttribute('data-depth');
        let matches = false;
        if (depthAttr === 'quick' && state.stepDepth === 3) matches = true;
        else if (depthAttr === 'standard' && state.stepDepth === 5) matches = true;
        else if (depthAttr === 'advanced' && state.stepDepth === 8) matches = true;
        else if (depthAttr === 'enterprise' && state.stepDepth === 12) matches = true;
        btn.classList.toggle('active', matches);
    });

    toggleViews();
    renderChatMessages();
    
    if (state.currentData) {
        displayResults(state.currentData);
    } else {
        elements.emptyState.classList.remove('hidden');
        elements.contentState.classList.add('hidden');
    }
    
    showToast('Proje başarıyla yüklendi!');
}

function deleteProjectSession(id) {
    let projects = [];
    try {
        projects = JSON.parse(localStorage.getItem('ai_arch_saved_projects')) || [];
    } catch (e) {
        console.error("Failed to parse projects list on delete", e);
    }
    projects = projects.filter(p => p.id !== id);
    try {
        localStorage.setItem('ai_arch_saved_projects', JSON.stringify(projects));
    } catch (e) {
        console.error(e);
    }
    
    if (state.projectId === id) {
        resetChatSession();
    } else {
        loadSavedProjectsList();
    }
    showToast('Proje silindi.');
}

// --- UNDO CHAT HISTORY STEP ---
function handleUndoChat() {
    if (state.historyStack.length <= 1) return;

    state.historyStack.pop();
    
    const prevState = state.historyStack[state.historyStack.length - 1];
    state.messages = JSON.parse(JSON.stringify(prevState.messages));
    state.currentData = JSON.parse(JSON.stringify(prevState.currentData));

    renderChatMessages();
    displayResults(state.currentData);
    saveCurrentProjectState();
    updateUndoButtonVisibility();
    
    showToast('Son adım başarıyla geri alındı!');
}

function updateUndoButtonVisibility() {
    if (state.historyStack.length > 1) {
        elements.btnUndoChat.classList.remove('hidden');
    } else {
        elements.btnUndoChat.classList.add('hidden');
    }
}

function scanForSecrets(content) {
    const secretRegexes = [
        /(key|password|secret|private_key|token|auth_token|passwd|credential|api_key)\s*[:=]\s*['"[a-zA-Z0-9_\-\.]{12,}/i,
        /-----BEGIN[ A-Z0-9_-]+PRIVATE KEY-----/i,
        /AIzaSy[A-Za-z0-9_\-]{33}/
    ];
    for (const regex of secretRegexes) {
        if (regex.test(content)) return true;
    }
    return false;
}

// --- CHAT FILE UPLOAD HANDLE ---
function handleChatFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // 1. File size check (Max 1MB)
    const MAX_SIZE = 1024 * 1024;
    if (file.size > MAX_SIZE) {
        showToast('Dosya boyutu çok büyük! En fazla 1MB büyüklüğünde dosyalar yüklenebilir.', true);
        e.target.value = '';
        return;
    }

    // 2. Extension check
    const allowedExtensions = ['json', 'txt', 'js', 'ts', 'md', 'cs', 'xml', 'html', 'css', 'yml', 'yaml', 'py', 'java', 'go', 'sh', 'bat', 'cpp', 'h'];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(ext)) {
        showToast('Yalnızca kod ve metin tabanlı belgelere izin verilir!', true);
        e.target.value = '';
        return;
    }

    // 3. User Cloud Ingestion Confirmation
    const cloudConfirm = confirm(`"${file.name}" dosyasını çözümlemek için Gemini bulut servisine göndermek istiyor musunuz?\n\nHassas verilerinizin güvenliği için dosyanın şifre veya gizli anahtar içermediğinden emin olun.`);
    if (!cloudConfirm) {
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
        const fileContent = event.target.result;

        // 4. Secret scan check
        if (scanForSecrets(fileContent)) {
            const bypass = confirm("UYARI: Yüklediğiniz dosyada API anahtarı, şifre veya gizli anahtar (secret) benzeri hassas bir veri tespit edildi!\n\nGüvenliğiniz için bu işlemi iptal etmeniz önerilir. Yine de devam etmek istiyor musunuz?");
            if (!bypass) {
                e.target.value = '';
                return;
            }
        }

        const fileSizeStr = (file.size / 1024).toFixed(1) + ' KB';

        state.messages.push({
            role: 'user',
            content: `[DOSYA YÜKLENDİ]: ${file.name} (${fileSizeStr})`,
            fileMeta: { name: file.name, size: fileSizeStr }
        });

        renderChatMessages();
        scrollChatToBottom();

        elements.chatTypingIndicator.classList.remove('hidden');
        scrollChatToBottom();

        const contextPayload = `[SİSTEM BİLGİSİ - KULLANICI DOSYA YÜKLEDİ]:
Dosya Adı: ${file.name}
Dosya Boyutu: ${fileSizeStr}
Dosya İçeriği:
"""
${fileContent}
"""

Lütfen bu dosya içeriğini analiz et. Oluşturduğun promptları ve editör kurallarını bu dosyadaki tablolara, nesnelere, import yollarına veya kütüphane versiyonlarına tam olarak uyumlu olacak şekilde yeniden derle.`;

        state.messages.push({
            role: 'user',
            content: contextPayload,
            hiddenContext: true
        });

        try {
            let result;
            if (state.apiKey && state.apiKey.length > 10) {
                result = await sendChatMessageToGemini();
            } else {
                await sleep(1500);
                result = generateOfflineConversationalResponse(`[dosya yüklendi] ${file.name}`);
            }

            state.messages.push({ role: 'model', content: result.chatResponse });
            state.currentData = result.projectFiles;

            renderChatMessages();
            displayResults(state.currentData);
            
            state.historyStack.push({
                messages: JSON.parse(JSON.stringify(state.messages)),
                currentData: JSON.parse(JSON.stringify(state.currentData))
            });
            updateUndoButtonVisibility();

            saveCurrentProjectState();

        } catch (error) {
            console.error(error);
            showToast('Dosya analizi başarısız!', true);
        } finally {
            elements.chatTypingIndicator.classList.add('hidden');
            scrollChatToBottom();
        }
    };
    reader.readAsText(file);
    elements.chatFileInput.value = '';
}

// --- START CHAT TRIGGER ---
async function handleStartChat() {
    const draft = elements.projectDescription.value.trim();
    if (!draft) {
        showToast('Lütfen başlangıç fikrinizi yazın!', true);
        return;
    }
    
    state.draftDescription = draft;
    
    // Dynamically detect project domain profile (HIGH-001)
    let detectedType = 'universal';
    const draftLower = draft.toLowerCase();
    if (draftLower.includes('game') || draftLower.includes('oyun') || draftLower.includes('unity') || draftLower.includes('unreal') || draftLower.includes('godot') || draftLower.includes('physics') || draftLower.includes('o-oyun')) {
        detectedType = 'game';
    } else if (draftLower.includes('mobil') || draftLower.includes('mobile') || draftLower.includes('ios') || draftLower.includes('android') || draftLower.includes('flutter') || draftLower.includes('react native') || draftLower.includes('swift') || draftLower.includes('kotlin')) {
        detectedType = 'mobile';
    } else if (draftLower.includes('script') || draftLower.includes('otomasyon') || draftLower.includes('cli') || draftLower.includes('scrap') || draftLower.includes('tool') || draftLower.includes('terminal')) {
        detectedType = 'script';
    } else if (draftLower.includes('api') || draftLower.includes('backend') || draftLower.includes('server') || draftLower.includes('db') || draftLower.includes('veritabanı') || draftLower.includes('sql') || draftLower.includes('docker')) {
        detectedType = 'backend';
    } else if (draftLower.includes('ai') || draftLower.includes('yapay zeka') || draftLower.includes('rag') || draftLower.includes('llm') || draftLower.includes('gpt') || draftLower.includes('model') || draftLower.includes('gemini') || draftLower.includes('claude')) {
        detectedType = 'ai';
    } else if (draftLower.includes('website') || draftLower.includes('web') || draftLower.includes('tanıtım') || draftLower.includes('react') || draftLower.includes('html') || draftLower.includes('css')) {
        detectedType = 'web';
    }
    state.projectType = detectedType;

    state.techStack = elements.techStackInput.value.trim() || DEFAULTS.techStack;
    state.techVersion = elements.techVersionSelect.value || DEFAULTS.techVersion;
    state.chatStarted = true;
    state.projectId = Date.now().toString();
    state.messages = [
        { role: 'user', content: draft }
    ];
    state.historyStack = [];
    
    toggleViews();
    renderChatMessages();

    // Prepare loading panel in outputs
    elements.emptyState.classList.add('hidden');
    elements.contentState.classList.add('hidden');
    elements.loadingTitle.textContent = "Mimar Projeyi Kuruyor...";
    elements.loadingStepText.textContent = "Tasarım hedefleri alınıyor ve teknoloji yığınına uygun editör kuralları kurgulanıyor...";
    elements.loadingState.classList.remove('hidden');
    
    elements.chatTypingIndicator.classList.remove('hidden');
    scrollChatToBottom();

    try {
        let result;
        if (state.apiKey && state.apiKey.length > 10) {
            result = await sendChatMessageToGemini();
        } else {
            await sleep(1500);
            result = generateOfflineConversationalResponse();
        }

        state.messages.push({ role: 'model', content: result.chatResponse });
        state.currentData = result.projectFiles;

        renderChatMessages();
        displayResults(state.currentData);
        
        state.historyStack.push({
            messages: JSON.parse(JSON.stringify(state.messages)),
            currentData: JSON.parse(JSON.stringify(state.currentData))
        });
        updateUndoButtonVisibility();

        saveCurrentProjectState();
        
    } catch (error) {
        console.error(error);
        showToast('Mimar başlatılamadı. Çevrimdışı simülatör devreye giriyor.', true);
        const result = generateOfflineConversationalResponse();
        state.messages.push({ role: 'model', content: result.chatResponse });
        state.currentData = result.projectFiles;
        renderChatMessages();
        displayResults(state.currentData);
        saveCurrentProjectState();
    } finally {
        elements.chatTypingIndicator.classList.add('hidden');
        scrollChatToBottom();
    }
}

// --- SEND CHAT TURN ---
async function handleSendChatMessage() {
    const text = elements.chatInputTextarea.value.trim();
    if (!text) return;

    elements.chatInputTextarea.value = '';
    state.messages.push({ role: 'user', content: text });
    
    renderChatMessages();
    scrollChatToBottom();

    elements.chatTypingIndicator.classList.remove('hidden');
    scrollChatToBottom();

    try {
        let result;
        if (state.apiKey && state.apiKey.length > 10) {
            result = await sendChatMessageToGemini();
        } else {
            await sleep(1200);
            result = generateOfflineConversationalResponse(text);
        }

        state.messages.push({ role: 'model', content: result.chatResponse });
        state.currentData = result.projectFiles;

        renderChatMessages();
        displayResults(state.currentData);
        
        state.historyStack.push({
            messages: JSON.parse(JSON.stringify(state.messages)),
            currentData: JSON.parse(JSON.stringify(state.currentData))
        });
        updateUndoButtonVisibility();

        saveCurrentProjectState();

    } catch (error) {
        console.error(error);
        showToast('Mimar yanıt veremedi. Çevrimdışı simülatör kullanılıyor.', true);
        const result = generateOfflineConversationalResponse(text);
        state.messages.push({ role: 'model', content: result.chatResponse });
        state.currentData = result.projectFiles;
        renderChatMessages();
        displayResults(state.currentData);
        saveCurrentProjectState();
    } finally {
        elements.chatTypingIndicator.classList.add('hidden');
        scrollChatToBottom();
    }
}

function validateProjectData(parsed) {
    const valid = {};
    if (!parsed || typeof parsed !== 'object') parsed = {};
    
    // Normalize prompts
    valid.prompts = Array.isArray(parsed.prompts) ? parsed.prompts.map(p => ({
        title: typeof p.title === 'string' ? p.title : 'Başlıksız Adım',
        description: typeof p.description === 'string' ? p.description : '',
        recommendedModel: typeof p.recommendedModel === 'string' ? p.recommendedModel : 'Claude 3.5 Sonnet',
        content: typeof p.content === 'string' ? p.content : '',
        developerNotes: typeof p.developerNotes === 'string' ? p.developerNotes : '',
        injectNotes: p.injectNotes !== false,
        subSteps: Array.isArray(p.subSteps) ? p.subSteps.map(s => ({
            title: typeof s.title === 'string' ? s.title : 'Alt Başlık',
            content: typeof s.content === 'string' ? s.content : ''
        })) : []
    })) : [];

    // Normalize docs
    const d = parsed.docs || {};
    valid.docs = {
        brief: typeof d.brief === 'string' ? d.brief : '',
        requirements: typeof d.requirements === 'string' ? d.requirements : '',
        architecture: typeof d.architecture === 'string' ? d.architecture : '',
        tech_stack: typeof d.tech_stack === 'string' ? d.tech_stack : '',
        risks: typeof d.risks === 'string' ? d.risks : '',
        state_md: typeof d.state_md === 'string' ? d.state_md : ''
    };

    // Normalize decisions
    valid.decisions = Array.isArray(parsed.decisions) ? parsed.decisions.map((dec, i) => ({
        id: typeof dec.id === 'string' ? dec.id : `DEC-00${i+1}`,
        title: typeof dec.title === 'string' ? dec.title : 'Karar Başlığı',
        decision: typeof dec.decision === 'string' ? dec.decision : '',
        reason: typeof dec.reason === 'string' ? dec.reason : ''
    })) : [];

    // Normalize assumptions
    valid.assumptions = Array.isArray(parsed.assumptions) ? parsed.assumptions.map((asm, i) => ({
        id: typeof asm.id === 'string' ? asm.id : `ASM-00${i+1}`,
        text: typeof asm.text === 'string' ? asm.text : '',
        confidence: typeof asm.confidence === 'string' ? asm.confidence : 'medium',
        status: typeof asm.status === 'string' ? asm.status : 'active'
    })) : [];

    // Normalize risks
    valid.risks = Array.isArray(parsed.risks) ? parsed.risks.map((r, i) => ({
        id: typeof r.id === 'string' ? r.id : `RSK-00${i+1}`,
        title: typeof r.title === 'string' ? r.title : '',
        probability: typeof r.probability === 'string' ? r.probability : 'medium',
        impact: typeof r.impact === 'string' ? r.impact : 'medium',
        mitigation: typeof r.mitigation === 'string' ? r.mitigation : ''
    })) : [];

    // Normalize openQuestions
    valid.openQuestions = Array.isArray(parsed.openQuestions) ? parsed.openQuestions.map((q, i) => ({
        id: typeof q.id === 'string' ? q.id : `Q-00${i+1}`,
        question: typeof q.question === 'string' ? q.question : '',
        importance: typeof q.importance === 'string' ? q.importance : 'medium'
    })) : [];

    // Normalize findings
    valid.findings = Array.isArray(parsed.findings) ? parsed.findings.map((f, i) => ({
        id: typeof f.id === 'string' ? f.id : `FND-00${i+1}`,
        title: typeof f.title === 'string' ? f.title : 'Bulgu',
        severity: typeof f.severity === 'string' ? f.severity : 'info',
        message: typeof f.message === 'string' ? f.message : '',
        mitigation: typeof f.mitigation === 'string' ? f.mitigation : ''
    })) : [];

    // Clamped Health Score
    let score = parseInt(parsed.healthScore);
    if (isNaN(score)) score = 85;
    valid.healthScore = Math.max(0, Math.min(100, score));

    // Normalize workflowStage
    const allowedStages = ['IDEA_CAPTURED', 'DISCOVERY_IN_PROGRESS', 'SCOPE_DRAFTED', 'MVP_DEFINED', 'READY_FOR_EXPORT'];
    valid.workflowStage = allowedStages.includes(parsed.workflowStage) ? parsed.workflowStage : 'SCOPE_DRAFTED';

    // Normalize subagents
    valid.subagents = Array.isArray(parsed.subagents) ? parsed.subagents.map(s => ({
        key: typeof s.key === 'string' ? s.key : 'subagent',
        role: typeof s.role === 'string' ? s.role : 'Ajan',
        filename: typeof s.filename === 'string' ? s.filename : 'agent.txt',
        prompt: typeof s.prompt === 'string' ? s.prompt : ''
    })) : [];

    // Normalize fileTree
    valid.fileTree = Array.isArray(parsed.fileTree) ? parsed.fileTree.map(f => ({
        path: typeof f.path === 'string' ? f.path : 'unknown.txt',
        type: typeof f.type === 'string' ? f.type : 'file',
        description: typeof f.description === 'string' ? f.description : ''
    })) : [];

    valid.mermaidCode = typeof parsed.mermaidCode === 'string' ? parsed.mermaidCode : 'graph TD\n    A[Proje] --> B[Modüller]';
    valid.skillMarkdown = typeof parsed.skillMarkdown === 'string' ? parsed.skillMarkdown : '';
    valid.cursorRules = typeof parsed.cursorRules === 'string' ? parsed.cursorRules : '';
    valid.windsurfRules = typeof parsed.windsurfRules === 'string' ? parsed.windsurfRules : '';
    valid.copilotRules = typeof parsed.copilotRules === 'string' ? parsed.copilotRules : '';
    valid.stateMarkdown = typeof parsed.stateMarkdown === 'string' ? parsed.stateMarkdown : '';

    return valid;
}

// --- CONVERSATIONAL GEMINI API INTEGRATION ---
async function sendChatMessageToGemini() {
    const activeFocuses = Object.keys(state.priorities).filter(k => state.priorities[k]);
    const focusesText = activeFocuses.map(f => f.toUpperCase()).join(', ');

    const historyText = state.messages.map(m => {
        const sender = m.role === 'user' ? 'Kullanıcı' : 'AI Mimar';
        return `${sender}: "${m.content}"`;
    }).join('\n');

    const promptText = `
Sen kıdemli bir Yapay Zeka Sistem Mimarı ve Ürün Yöneticisisin. Kullanıcı ile projesini sohbet ederek şekillendiriyorsun.
Kullanıcının projesine ne gibi yenilibel özellikler eklenebileceğini, kod kalitesini, nelerde performans/güvenlik zayıflıkları ve olası yazılım hataları (bugs) olabileceğini tartışıyorsun.

Şu anki proje parametreleri:
- Proje Türü: ${state.projectType.toUpperCase()}
- Hedeflenen Teknoloji Yığını: ${state.techStack} (Sürüm: ${state.techVersion})
- Öncelikli Odaklar: ${focusesText}

Aşağıda kullanıcı ile olan sohbet geçmişi listelenmiştir. Lütfen kullanıcının son mesajını yanıtla. Yanıtın son derece teknik, yol gösterici, cana yakın ve fikir geliştirici olsun.
Aynı zamanda, projenin son haline göre yapay zeka kodlama araçlarının (Cursor, Windsurf, Copilot vb.) okuyabileceği yapılandırma dosyalarını (.cursorrules, .windsurfrules, copilot-instructions.md, SKILL.md, state.md, TASARIM_MİMARİSİ.md, prompt zincirleri, subagent promptları) tamamen güncelle, kararları/varsayımları/riskleri/açık soruları/kalite raporunu içeren evrensel proje modeline dönüştür ve JSON içinde döndür.

CRITICAL INSTRUCTIONS FOR CONFIGURATION OUTPUTS:
1. Geliştirme Prompt Zinciri (prompts dizisi) tam olarak ${state.stepDepth} adımdan oluşmalıdır. Ne eksik ne fazla!
2. Her geliştirme adım promptunun içine mutlaka belirgin şekilde şunları ekle:
   - [DOSYA BAĞLAM HARİTASI (CONTEXT MAP)]: Ajanın o adımda okuması gereken dosyalar ve değiştirmesi gereken dosyaların listesi. (Seçilen teknoloji yığını ${state.techStack} dosya yapısına uygun olsun).
   - [KABUL KRİTERLERİ & DOĞRULAMA SENARYOLARI]: Ajanın adımı tamamlayıp doğrulamak için yapası gereken testler.
   - [ÖN KOŞULLAR & DURUM GEÇİŞ KAPILARI (STATE GATES)]: Adıma başlamadan önce bir önceki adımdaki hangi dosyaların veya servislerin stabil çalışması gerektiğini belirten katı yönerge.
   - 'recommendedModel' alanını her adım nesnesinde belirt (Örn: "Claude 3.5 Sonnet (Yüksek UI)" veya "GPT-4o mini (Hızlı Kod)").
3. 'docs' alanı: Aşağıdaki alt dökümanları barındıran obje:
   - 'brief': PROJECT_BRIEF.md içeriği.
   - 'requirements': REQUIREMENTS.md içeriği.
   - 'architecture': ARCHITECTURE.md içeriği.
   - 'tech_stack': TECH_STACK.md içeriği.
   - 'risks': RISKS.md içeriği.
   - 'state_md': state.md içeriği.
4. 'mermaidCode' alanı: Projenin veritabanı ilişkilerini (ERD) veya durum akış şemasını temsil eden Mermaid.js diyagramı kodu (erDiagram veya stateDiagram-v2 formatında).
5. 'fileTree' alanı: Projenin dosya yapısını temsil eden JSON dizisi. Örneğin:
   [
     { "path": "src", "type": "folder" },
     { "path": "src/components", "type": "folder" },
     { "path": "src/components/Navbar.tsx", "type": "file", "description": "Görsel menü" }
   ]
6. Editör kuralları için JSON çıktısında 3 farklı kural alanını da doldur:
   - 'cursorRules': Cursor (.cursorrules) içeriği (Sürüm: ${state.techVersion} kurallarını da içersin).
   - 'windsurfRules': Windsurf (.windsurfrules) içeriği.
   - 'copilotRules': GitHub Copilot (.github/copilot-instructions.md) için hazırlanmış Markdown formatı.
7. Dinamik Alt Ajan Rolleri ('subagents' listesi):
   - Projenin türüne uygun 3 adet dinamik alt ajan tanımla ve bunları JSON dizisi olarak döndür.
   - Her bir ajan objesi şu yapıda olmalı:
     {
       "key": "unique_agent_key",
       "role": "Ajan Görev Rol Adı",
       "filename": "dosya_ismi.txt",
       "prompt": "Harici ajana verilecek detaylı ve sistem promptu yönergesi."
     }
8. Proje Karar ve Hafıza Yapıları:
   - 'decisions': Proje esnasında alınan kararlar listesi. Örn: [ { "id": "DEC-001", "title": "...", "decision": "...", "reason": "..." } ]
   - 'assumptions': Kabullenilen varsayımlar listesi. Örn: [ { "id": "ASM-001", "text": "...", "confidence": "high|medium|low", "status": "active" } ]
   - 'risks': Riskler listesi. Örn: [ { "id": "RSK-001", "title": "...", "probability": "high|medium|low", "impact": "high|medium|low", "mitigation": "..." } ]
   - 'openQuestions': Açık kalan sorular listesi. Örn: [ { "id": "Q-001", "question": "...", "importance": "high|medium|low" } ]
9. Sağlık ve Kalite Analizi:
   - 'healthScore': 0-100 arası bir tamsayı.
   - 'findings': Kalite denetim bulguları listesi. Örn: [ { "id": "FND-001", "title": "...", "severity": "info|warning", "message": "...", "mitigation": "..." } ]
10. Akış Aşaması:
    - 'workflowStage': Projenin durumunu belirten değer ('IDEA_CAPTURED', 'DISCOVERY_IN_PROGRESS', 'SCOPE_DRAFTED', 'MVP_DEFINED', 'READY_FOR_EXPORT' değerlerinden biri).

Yanıtını AŞAĞIDAKİ JSON formatında dön:
{
  "chatResponse": "Kullanıcıya yazacağın sohbet yanıtı (markdown biçiminde).",
  "projectFiles": {
    "prompts": [
      {
        "title": "Adım Başlığı",
        "description": "Açıklama",
        "recommendedModel": "Claude 3.5 Sonnet (Yüksek UI)",
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
    "fileTree": [ ... ],
    "skillMarkdown": "SKILL.md içeriği. Sürüm: ${state.techVersion} API kurallarını da dahil et.",
    "cursorRules": "Cursor (.cursorrules) içeriği.",
    "windsurfRules": "Windsurf (.windsurfrules) içeriği.",
    "copilotRules": "GitHub Copilot (instructions.md) içeriği.",
    "subagents": [ ... ],
    "decisions": [ ... ],
    "assumptions": [ ... ],
    "risks": [ ... ],
    "openQuestions": [ ... ],
    "healthScore": 85,
    "findings": [ ... ],
    "workflowStage": "SCOPE_DRAFTED"
  }
}

Sohbet geçmişi:
${historyText}

Tüm çıktıları Türkçe ver.
`;

    try {
        const textResponse = await LLMProvider.generateContent(promptText, state.apiKey, true);
        const parsed = JSON.parse(textResponse);
        if (parsed && parsed.projectFiles) {
            parsed.projectFiles = validateProjectData(parsed.projectFiles);
        }
        return parsed;
    } catch (err) {
        console.error("Gemini API parsing/validation error:", err);
        throw err;
    }
}

// --- CONVERSATIONAL OFFLINE CHATBOT SIMULATOR ---
function generateOfflineConversationalResponse(userMessage = '') {
    const msg = userMessage.toLowerCase();
    let chatResponse = '';
    
    if (!userMessage) {
        chatResponse = `Merhaba! Projeniz olan **"${state.draftDescription}"** için planlanan **${state.stepDepth} adımlı** mimariyi ve teknoloji yığını standartlarını hazırladım. 
        
Projenize başka hangi özellikleri eklemek istersiniz? Örneğin ödeme entegrasyonu, veritabanı seçimi, üyelik sistemi veya performans optimizasyonlarından hangisini tartışalım?`;
    } else if (msg.includes('auth') || msg.includes('üyelik') || msg.includes('giriş') || msg.includes('login')) {
        chatResponse = `Harika, üyelik sistemi (Authentication) entegrasyonu projenizi çok daha güvenli kılacaktır! 
        
Bunun için projenin editör kurallarına ve **SKILL.md** dosyasına JWT şifreleme, HTTPS yönlendirmeleri, şifre hash'leme standartları ve oturum yönetimi kurallarını ekledim. Hangi veri tabanını veya Auth servisini (Firebase Auth, Auth0 vb.) kullanmayı tercih edersiniz?`;
    } else if (msg.includes('ödeme') || msg.includes('stripe') || msg.includes('pay')) {
        chatResponse = `Ödeme entegrasyonunu (Stripe) ekliyoruz! Bu adımda güvenlik en kritik noktadır.
        
Backend ve Güvenlik ajanlarına ödeme akışlarını denetlemesi, webhook doğrulaması yapması ve ön yüzdeki ödeme bilgilerini asla direkt sunucuya taşımaması için özel güvenlik talimatları ekledim. Ayrıca adım promptlarınıza bir 'Ödeme ve Stripe Entegrasyonu' adımı ilave ettim. Sırada ne var?`;
    } else if (msg.includes('db') || msg.includes('veritabanı') || msg.includes('database') || msg.includes('firebase') || msg.includes('postgres') || msg.includes('mongo')) {
        chatResponse = `Veri tabanı mimarisi netleşti! Projenizde verileri kararlı bir şekilde yönetmek için gerekli klasör şemalarını ve state yönetim kurallarını güncelledim. 
        
Verilerin otonom ajana kodlatılabilmesi için hazırladığım veri tabanı sorgu optimizasyonları ve validasyonlar içeren promptları güncelledim. Arayüzün (UI/UX) premium görünmesi için animasyonlar veya cam efekti gibi tasarımlara geçelim mi?`;
    } else if (msg.includes('[sistem geri besleme]')) {
        chatResponse = `Hata kuralı başarıyla projenin kurallarına ve dosyalarına entegre edildi!
        
Hata Giderici sekmesinde çözdüğümüz sorunu projenin mimari tasarım sistemine (.cursorrules ve SKILL.md) kalıcı bir standart olarak ekledim. Böylece kod yazan ajanın bu hatayı yapmasını engellemiş olduk. Başka bir hata var mı yoksa devam mı edelim?`;
    } else if (msg.includes('[dosya yüklendi]')) {
        chatResponse = `Yüklediğiniz dosyayı başarıyla analiz ettim! 
        
Dosya içeriğini inceleyerek, oluşturduğum **Geliştirme Adımlarını**, **.cursorrules** kural dosyasını ve **SKILL.md** şablonunu bu dosyadaki tablolara, nesnelere ve import yollarına %100 uyumlu olacak şekilde yeniden yapılandırdım. İnceleyebilirsiniz!`;
    } else {
        chatResponse = `Fikrinizi güncelledim ve dosyaları bu yönde genişlettim! 
        
Sağ paneldeki **Prompt Zinciri**, **SKILL.md**, **Editör Kuralları** ve **Alt Ajan Promptları** güncel konuşmamız doğrultusunda revize edildi. Projede dikkat etmemiz gereken güvenlik veya performans odakları hakkında konuşmaya devam etmek ister misiniz yoksa dosyaları indirmeye hazır mısınız?`;
    }

    const projectFiles = validateProjectData(generateOfflineArtifacts(state.draftDescription + ' ' + state.messages.map(m => m.content).join(' '), state.projectType, state.priorities));

    return {
        chatResponse,
        projectFiles
    };
}

// --- RENDER CHAT MESSAGES IN UI ---
function renderChatMessages() {
    elements.chatMessagesContainer.innerHTML = '';
    
    state.messages.forEach(msg => {
        if (msg.hiddenContext) return;

        const bubble = document.createElement('div');
        
        if (msg.fileMeta) {
            bubble.className = 'chat-bubble-file';
            bubble.innerHTML = `
                <div class="chat-file-meta">
                    <i data-lucide="file-text"></i>
                    <span class="filename-text">${escapeHTML(msg.fileMeta.name)}</span>
                    <span class="filesize-text">${escapeHTML(msg.fileMeta.size)}</span>
                </div>
            `;
            elements.chatMessagesContainer.appendChild(bubble);
            return;
        }

        const isModel = msg.role === 'model';
        bubble.className = `chat-bubble ${isModel ? 'chat-bubble-agent' : 'chat-bubble-user'}`;
        
        if (isModel) {
            bubble.innerHTML = parseChatMarkdown(msg.content);
        } else {
            bubble.textContent = msg.content;
        }
        
        elements.chatMessagesContainer.appendChild(bubble);
    });

    if (window.lucide) window.lucide.createIcons();
}

function scrollChatToBottom() {
    elements.chatMessagesContainer.scrollTop = elements.chatMessagesContainer.scrollHeight;
}

// Simple Markdown Parser
function parseChatMarkdown(text) {
    let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');

    html = html.replace(/(?:<br>|^)-\s+(.*?)(?=<br>|$)/g, '<li>$1</li>');
    html = html.replace(/(<li>.*?<\/li>)/g, '<ul>$1</ul>');
    html = html.replace(/<\/ul><ul>/g, '');

    html = html.replace(/(?:<br>|^)###\s+(.*?)(?=<br>|$)/g, '<h4>$1</h4>');
    html = html.replace(/(?:<br>|^)##\s+(.*?)(?=<br>|$)/g, '<h3>$1</h3>');

    return html;
}

// --- DISPLAY DYNAMIC CONFIG RESULTS ---
function displayResults(data) {
    elements.loadingState.classList.add('hidden');
    elements.contentState.classList.remove('hidden');

    elements.pipelineList.innerHTML = '';

    data.prompts.forEach((step, index) => {
        const stepIndex = index + 1;
        const stepEl = document.createElement('div');
        stepEl.className = `pipeline-step ${index === 0 ? 'open' : ''}`;
        
        const modelBadge = step.recommendedModel ? `<span class="model-recommend-badge"><i data-lucide="sparkles" style="width:10px;height:10px;margin-bottom:0;vertical-align:middle;margin-right:2px;display:inline-block;"></i>${escapeHTML(step.recommendedModel)}</span>` : '';
        
        stepEl.innerHTML = `
            <div class="step-header">
                <div class="step-title-group" style="width:70%;">
                    <span class="step-number">${stepIndex}</span>
                    <h4>${escapeHTML(step.title)}</h4>
                </div>
                <div class="step-actions">
                    ${modelBadge}
                    <button class="btn btn-secondary btn-small btn-copy-step" data-index="${index}">
                        <i data-lucide="copy"></i>
                        <span>Kopyala</span>
                    </button>
                    <i data-lucide="chevron-down" class="step-chevron"></i>
                </div>
            </div>
            <div class="step-body">
                <div class="step-description">${escapeHTML(step.description)}</div>
                <div class="prompt-box">
                    <pre><code class="prompt-code-text" id="step-code-${index}">${escapeHTML(getInjectedPromptContent(index))}</code></pre>
                </div>
                
                <!-- Developer Notepad Box -->
                <div class="developer-notepad-box">
                    <div class="developer-notepad-header">
                        <label><i data-lucide="edit-3" style="width:12px;height:12px;"></i><span>Geliştirici Not Defteri (Sonraki Adımlara Enjekte Edilir)</span></label>
                        <label style="text-transform:none; display:flex; align-items:center; gap:0.2rem;">
                            <input type="checkbox" class="inject-notes-cb" data-index="${index}" ${step.injectNotes !== false ? 'checked' : ''}>
                            <span>Notu Sonraki Adımlara Ekle</span>
                        </label>
                    </div>
                    <textarea class="step-notes-textarea" data-index="${index}" placeholder="Bu adımda aldığınız manuel kararları yazın (Örn: Port 8080 yapıldı, tablo ismi user_logs oldu)...">${escapeHTML(step.developerNotes || '')}</textarea>
                </div>

                <!-- Footer slice buttons -->
                <div class="step-actions-footer">
                    <button class="btn btn-secondary btn-small btn-slice-step" data-index="${index}">
                        <i data-lucide="scissors" style="width:12px;height:12px;margin-right:0;"></i>
                        <span>Adımı Alt Parçalara Böl</span>
                    </button>
                </div>
                
                <!-- Dynamic Sliced Substeps Area -->
                <div class="sub-steps-container hidden" id="sub-steps-container-${index}">
                    <!-- Sliced steps loaded here -->
                </div>
            </div>
        `;
        
        stepEl.querySelector('.step-header').addEventListener('click', (e) => {
            if (e.target.closest('.btn-copy-step')) return;
            stepEl.classList.toggle('open');
        });

        stepEl.querySelector('.btn-copy-step').addEventListener('click', () => {
            copyTextToClipboard(getInjectedPromptContent(index));
        });

        stepEl.querySelector('.btn-slice-step').addEventListener('click', () => {
            handleSliceStep(index);
        });

        const textarea = stepEl.querySelector('.step-notes-textarea');
        textarea.addEventListener('input', (e) => {
            state.currentData.prompts[index].developerNotes = e.target.value.trim();
            saveCurrentProjectState();
            refreshPromptOutputs();
        });

        const checkbox = stepEl.querySelector('.inject-notes-cb');
        checkbox.addEventListener('change', (e) => {
            state.currentData.prompts[index].injectNotes = e.target.checked;
            saveCurrentProjectState();
            refreshPromptOutputs();
        });

        elements.pipelineList.appendChild(stepEl);
        
        if (step.subSteps && step.subSteps.length > 0) {
            renderSubStepsUI(index, step.subSteps);
        }
    });
    elements.skillCode.textContent = getFilteredSkillMarkdown();
    
    // Draw Mermaid Diagram
    drawMermaidDiagram(data.mermaidCode);

    // Render file tree
    renderFileTree();

    updateEditorRulesView();
    renderDynamicSubagents(data.subagents);

    // Update workflow status tracker
    updateWorkflowTracker(data.workflowStage || 'IDEA_CAPTURED');

    // Populate Proje Hafızası (Decisions)
    elements.memoryDecisionsList.innerHTML = '';
    const decisions = data.decisions || [
        { id: "DEC-001", title: "Katmanlı Mimari Yapısı", decision: "Domain katmanını altyapıdan tamamen ayırma.", reason: "Gelecekte CLI veya Cloud geçişini kolaylaştırma." },
        { id: "DEC-002", title: "Local-First Veri Depolama", decision: "Proje listesini SQLite / LocalStorage üzerinde tutma.", reason: "Hızlı, offline çalışabilen ve sunucu bağımsız yapı." }
    ];
    decisions.forEach(dec => {
        const decCard = document.createElement('div');
        decCard.className = 'project-history-card';
        decCard.style.padding = '0.8rem';
        decCard.style.marginBottom = '0.5rem';
        decCard.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
                <strong style="color:var(--accent); font-size:0.8rem;">${escapeHTML(dec.id)}</strong>
                <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">${escapeHTML(dec.title)}</span>
            </div>
            <div style="font-size:0.8rem; color:white; margin-bottom:0.2rem;"><strong>Karar:</strong> ${escapeHTML(dec.decision)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.4rem;"><strong>Gerekçe:</strong> ${escapeHTML(dec.reason)}</div>
            <div class="decision-actions" style="display:flex; gap:0.4rem;">
                <button class="btn btn-secondary btn-small btn-dec-impact" data-id="${escapeHTML(dec.id)}" style="padding:0.1rem 0.3rem; font-size:0.65rem; background:rgba(139,92,246,0.15); color:var(--primary-hover);">Etki Analizini Göster</button>
            </div>
        `;
        decCard.querySelector('.btn-dec-impact').addEventListener('click', () => {
            showDecisionImpactAnalysis(dec.id, dec.title);
        });
        elements.memoryDecisionsList.appendChild(decCard);
    });

    // Populate Proje Hafızası (Assumptions & Risks & Questions)
    elements.memoryAssumptionsList.innerHTML = '';
    const assumptions = data.assumptions || [
        { id: "ASM-001", text: "Kullanıcılar uygulamayı lokalde veya offline modda kullanabilir.", confidence: "high", status: "active" },
        { id: "ASM-002", text: "Üretilen ZIP paketleri popüler IDE'lerde (VS Code, Cursor) doğrudan açılacaktır.", confidence: "high", status: "active" }
    ];
    const risks = data.risks || [
        { id: "RSK-001", title: "Büyük dosya taramalarında token aşımı", probability: "medium", impact: "high", mitigation: "Varsayılan ignore (.gitignore) kurallarını katı şekilde uygulama." }
    ];
    const openQuestions = data.openQuestions || [
        { id: "Q-001", question: "İleride Git reposu otomatik oluşturulsun mu?", importance: "low" }
    ];

    assumptions.forEach(asm => {
        const card = document.createElement('div');
        card.className = 'project-history-card';
        card.style.padding = '0.8rem';
        card.style.marginBottom = '0.5rem';
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
                <strong style="color:var(--secondary); font-size:0.8rem;">${escapeHTML(asm.id)} (Varsayım)</strong>
                <span style="font-size:0.7rem; padding:0.1rem 0.3rem; background:rgba(6,182,212,0.15); color:var(--secondary); border-radius:3px;">Güven: ${escapeHTML(asm.confidence)}</span>
            </div>
            <div style="font-size:0.75rem; color:white;">${escapeHTML(asm.text)}</div>
        `;
        elements.memoryAssumptionsList.appendChild(card);
    });

    risks.forEach(r => {
        const card = document.createElement('div');
        card.className = 'project-history-card';
        card.style.padding = '0.8rem';
        card.style.marginBottom = '0.5rem';
        card.style.borderLeft = '3px solid var(--danger)';
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
                <strong style="color:var(--danger); font-size:0.8rem;">${escapeHTML(r.id)} (Risk)</strong>
                <span style="font-size:0.7rem; color:var(--text-muted);">Etki: ${escapeHTML(r.impact)}</span>
            </div>
            <div style="font-size:0.75rem; color:white; margin-bottom:0.2rem;"><strong>Risk:</strong> ${escapeHTML(r.title)}</div>
            <div style="font-size:0.7rem; color:var(--text-muted);"><strong>Önlem:</strong> ${escapeHTML(r.mitigation)}</div>
        `;
        elements.memoryAssumptionsList.appendChild(card);
    });

    openQuestions.forEach(q => {
        const card = document.createElement('div');
        card.className = 'project-history-card';
        card.style.padding = '0.8rem';
        card.style.marginBottom = '0.5rem';
        card.style.borderLeft = '3px solid var(--warning)';
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
                <strong style="color:var(--warning); font-size:0.8rem;">${escapeHTML(q.id)} (Açık Soru)</strong>
                <span style="font-size:0.7rem; color:var(--text-muted);">Önem: ${escapeHTML(q.importance)}</span>
            </div>
            <div style="font-size:0.75rem; color:white;">${escapeHTML(q.question)}</div>
        `;
        elements.memoryAssumptionsList.appendChild(card);
    });

    // Render Health Score & Quality findings
    const healthVal = data.healthScore || 85;
    elements.healthScorePercentage.textContent = healthVal;
    
    // Choose health color based on score
    if (healthVal >= 80) {
        elements.healthScorePercentage.style.color = 'var(--success)';
    } else if (healthVal >= 60) {
        elements.healthScorePercentage.style.color = 'var(--warning)';
    } else {
        elements.healthScorePercentage.style.color = 'var(--danger)';
    }

    elements.reviewerFindingsContainer.innerHTML = '';
    const findings = data.findings || [
        { id: "FND-001", title: "Sürüm Koruması Aktif", severity: "info", message: `Seçilen teknoloji sürümü (${state.techVersion}) koruma altına alındı.`, mitigation: "Ajan promptlarında kurallar kilitlendi." },
        { id: "FND-002", title: "Çevrimdışı Mod Çalışıyor", severity: "info", message: "Planlayıcı çevrimdışı şablon modunda çalışmaktadır.", mitigation: "API anahtarı girildiğinde canlı planlamaya geçilir." }
    ];
    findings.forEach(f => {
        const fEl = document.createElement('div');
        const isInfo = f.severity === 'info';
        const isWarning = f.severity === 'warning';
        fEl.className = `info-alert ${isInfo ? 'info-gradient' : 'warning-gradient'}`;
        fEl.style.padding = '0.8rem 1.2rem';
        fEl.style.marginBottom = '0.5rem';
        
        const icon = isInfo ? 'info' : 'alert-triangle';
        fEl.innerHTML = `
            <div class="alert-icon"><i data-lucide="${icon}"></i></div>
            <div class="alert-body" style="width: 100%;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.1rem;">
                    <h4 style="font-size:0.82rem; color:white; margin:0;">${escapeHTML(f.title)} (${escapeHTML(f.id)})</h4>
                    <span style="font-size:0.65rem; padding:0.1rem 0.3rem; border-radius:3px; background:rgba(255,255,255,0.08); color:var(--text-muted);">${escapeHTML(f.severity.toUpperCase())}</span>
                </div>
                <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.2rem;">${escapeHTML(f.message)}</p>
                <p style="font-size:0.7rem; color:var(--accent); margin-bottom:0.4rem;"><strong>Çözüm Yolu:</strong> ${escapeHTML(f.mitigation)}</p>
                <div class="finding-actions" style="display:flex; gap:0.4rem; flex-wrap:wrap; margin-top:0.3rem;">
                    <button class="btn btn-secondary btn-small btn-finding-accept" style="padding:0.15rem 0.35rem; font-size:0.65rem;">Kabul Et</button>
                    <button class="btn btn-secondary btn-small btn-finding-reject" style="padding:0.15rem 0.35rem; font-size:0.65rem;">Reddet</button>
                    <button class="btn btn-secondary btn-small btn-finding-why" style="padding:0.15rem 0.35rem; font-size:0.65rem;">Nedenini Açıkla</button>
                    <button class="btn btn-secondary btn-small btn-finding-alt" style="padding:0.15rem 0.35rem; font-size:0.65rem;">Alternatif Üret</button>
                </div>
            </div>
        `;
        
        fEl.querySelector('.btn-finding-accept').addEventListener('click', () => {
            showToast('Öneri kabul edildi ve plana dahil edildi!');
            fEl.style.opacity = '0.5';
            fEl.querySelector('.finding-actions').style.display = 'none';
        });
        fEl.querySelector('.btn-finding-reject').addEventListener('click', () => {
            showToast('Öneri reddedildi.');
            fEl.style.opacity = '0.3';
            fEl.querySelector('.finding-actions').style.display = 'none';
        });
        fEl.querySelector('.btn-finding-why').addEventListener('click', () => {
            elements.chatInputTextarea.value = `${escapeHTML(f.id)} (${escapeHTML(f.title)}) bulgusunun nedenini açıklar mısın?`;
            elements.chatInputTextarea.focus();
            showToast('Soru giriş alanına eklendi!');
        });
        fEl.querySelector('.btn-finding-alt').addEventListener('click', () => {
            elements.chatInputTextarea.value = `${escapeHTML(f.id)} (${escapeHTML(f.title)}) için alternatif bir çözüm üretir misin?`;
            elements.chatInputTextarea.focus();
            showToast('İstek giriş alanına eklendi!');
        });
        
        elements.reviewerFindingsContainer.appendChild(fEl);
    });

    // Populate Tab 4 Proje Belgeleri
    updateProjectDocView();

    if (window.lucide) {
        window.lucide.createIcons();
    }
}
// --- RENDER MERMAID VECTOR DIAGRAM ---
async function drawMermaidDiagram(code) {
    const container = document.getElementById('panel-architecture');
    let renderArea = document.getElementById('mermaid-render-area');
    if (!renderArea) {
        renderArea = document.createElement('div');
        renderArea.id = 'mermaid-render-area';
        renderArea.style.marginTop = '1.5rem';
        renderArea.style.padding = '1.2rem';
        renderArea.style.background = 'rgba(0,0,0,0.3)';
        renderArea.style.border = '1px solid var(--border-color)';
        renderArea.style.borderRadius = 'var(--radius-sm)';
        renderArea.style.display = 'flex';
        renderArea.style.flexDirection = 'column';
        renderArea.style.alignItems = 'center';
        renderArea.style.overflowX = 'auto';
        
        const title = document.createElement('h4');
        title.innerHTML = `<i data-lucide="line-chart" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Görsel Mimari Akış / Diyagram`;
        title.style.fontSize = '0.85rem';
        title.style.color = 'var(--accent)';
        title.style.textTransform = 'uppercase';
        title.style.marginBottom = '0.8rem';
        title.style.width = '100%';
        
        container.appendChild(title);
        container.appendChild(renderArea);
    }
    
    if (window.mermaid && code) {
        let cleanedCode = code.trim();
        if (cleanedCode.startsWith("```")) {
            cleanedCode = cleanedCode.replace(/^```[a-zA-Z0-9]*\n?/, "");
            cleanedCode = cleanedCode.replace(/\n?```$/, "");
        }
        try {
            renderArea.innerHTML = '<span class="loader-circle" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span>Diyagram Çiziliyor...';
            const uniqueId = 'mermaid-svg-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
            const { svg } = await window.mermaid.render(uniqueId, cleanedCode);
            renderArea.innerHTML = svg;
        } catch (err) {
            console.error("Mermaid Render Error: ", err);
            renderArea.innerHTML = `<p style="font-size:0.8rem;color:#ef4444;text-align:center;">Diyagram çizim hatası! (Diyagram raw kodu TASARIM_MİMARİSİ.md içinde saklanır)</p>`;
        }
    } else {
        if (renderArea) renderArea.innerHTML = `<p style="font-size:0.8rem;color:var(--text-muted);">Görsel diyagram kurgulanmamış.</p>`;
    }
    if (window.lucide) window.lucide.createIcons();
}

// --- INTERACTIVE FILE TREE RENDERER ---
function renderFileTree() {
    elements.fileTreeContainer.innerHTML = '';
    if (!state.currentData || !state.currentData.fileTree) return;

    // Sort by path
    const sorted = [...state.currentData.fileTree].sort((a, b) => a.path.localeCompare(b.path));

    sorted.forEach((item, index) => {
        const parts = item.path.split('/');
        const depth = parts.length - 1;
        const name = parts[parts.length - 1];

        const itemEl = document.createElement('div');
        itemEl.className = 'file-tree-item';
        itemEl.style.paddingLeft = `${depth * 1.5 + 0.6}rem`;

        const iconType = item.type === 'folder' ? 'folder' : 'file-text';
        const iconClass = item.type === 'folder' ? 'folder-icon' : 'file-icon';

        itemEl.innerHTML = `
            <div class="file-tree-meta">
                <i class="${iconClass}" data-lucide="${iconType}"></i>
                <span class="file-name-text" id="file-name-text-${index}">${escapeHTML(name)}</span>
                <span style="font-size:0.7rem; color:var(--text-muted); font-family:var(--font-sans); margin-left:0.4rem;">${item.description ? `- ${escapeHTML(item.description)}` : ''}</span>
            </div>
            <div class="file-tree-item-actions">
                <button class="btn-file-tree-action btn-rename" data-index="${index}" title="Yeniden Adlandır">
                    <i data-lucide="edit-2" style="width:12px; height:12px;"></i>
                </button>
                <button class="btn-file-tree-action delete btn-delete-file" data-index="${index}" title="Sil">
                    <i data-lucide="trash-2" style="width:12px; height:12px;"></i>
                </button>
            </div>
        `;

        // Rename logic
        itemEl.querySelector('.btn-rename').addEventListener('click', () => {
            const span = document.getElementById(`file-name-text-${index}`);
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'file-tree-input';
            input.value = name;
            
            span.replaceWith(input);
            input.focus();

            const finishRename = () => {
                const newName = input.value.trim();
                if (newName && newName !== name) {
                    const oldPath = item.path;
                    const pathParts = oldPath.split('/');
                    pathParts[pathParts.length - 1] = newName;
                    const newPath = pathParts.join('/');

                    // Update parent path
                    item.path = newPath;

                    // Update child paths if it is a folder
                    if (item.type === 'folder') {
                        state.currentData.fileTree.forEach(c => {
                            if (c.path.startsWith(oldPath + '/')) {
                                c.path = c.path.replace(oldPath + '/', newPath + '/');
                            }
                        });
                    }

                    saveCurrentProjectState();
                    renderFileTree();
                    refreshPromptOutputs();
                } else {
                    renderFileTree();
                }
            };

            input.addEventListener('blur', finishRename);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') finishRename();
                if (e.key === 'Escape') renderFileTree();
            });
        });

        // Delete logic
        itemEl.querySelector('.btn-delete-file').addEventListener('click', () => {
            const pathToDelete = item.path;
            
            // Filter out item and its children if folder
            state.currentData.fileTree = state.currentData.fileTree.filter(c => {
                if (c.path === pathToDelete) return false;
                if (item.type === 'folder' && c.path.startsWith(pathToDelete + '/')) return false;
                return true;
            });

            saveCurrentProjectState();
            renderFileTree();
            refreshPromptOutputs();
            showToast('Dosya silindi.');
        });

        elements.fileTreeContainer.appendChild(itemEl);
    });

    if (window.lucide) window.lucide.createIcons();
}

// Add File or Folder to interactive tree
function handleAddFileTreeItem(type) {
    if (!state.currentData || !state.currentData.fileTree) {
        showToast('Aktif dosya yapısı yok!', true);
        return;
    }

    const name = prompt(type === 'folder' ? 'Yeni klasörün adı:' : 'Yeni dosyanın adı (örn: index.js):');
    if (!name) return;

    let path = name;
    // Find if a folder is selected, or just append to root
    state.currentData.fileTree.push({
        path: path,
        type: type,
        description: type === 'folder' ? 'Kullanıcı klasörü' : 'Kullanıcı dosyası'
    });

    saveCurrentProjectState();
    renderFileTree();
    refreshPromptOutputs();
    showToast('Klasör ağacına eklendi!');
}

// Build ASCII Tree representation for prompt injection
function buildAsciiFileTree() {
    if (!state.currentData || !state.currentData.fileTree) return '';
    
    const sorted = [...state.currentData.fileTree].sort((a,b) => a.path.localeCompare(b.path));
    let treeText = '';
    
    sorted.forEach(item => {
        const parts = item.path.split('/');
        const depth = parts.length - 1;
        const indent = '  '.repeat(depth);
        const name = parts[parts.length - 1];
        const prefix = item.type === 'folder' ? '📁 ' : '📄 ';
        const desc = item.description ? ` (${item.description})` : '';
        treeText += `${indent}${prefix}${name}${desc}\n`;
    });
    
    return treeText;
}

// --- DYNAMIC REFRESH OF ENJECTED PROMPTS ---
function refreshPromptOutputs() {
    state.currentData.prompts.forEach((step, index) => {
        const codeBox = document.getElementById(`step-code-${index}`);
        if (codeBox) {
            codeBox.textContent = getInjectedPromptContent(index);
        }
    });
}

// --- INJECT DEVELOPER NOTES & DYNAMIC FILE TREE INTO NEXT PROMPTS ---
function getInjectedPromptContent(targetIdx) {
    if (!state.currentData || !state.currentData.prompts) return '';
    const step = state.currentData.prompts[targetIdx];
    let content = step.content;

    let notesText = '';
    for (let i = 0; i < targetIdx; i++) {
        const prevStep = state.currentData.prompts[i];
        if (prevStep.injectNotes !== false && prevStep.developerNotes && prevStep.developerNotes.trim()) {
            notesText += `- Adım ${i + 1} Kararı: "${prevStep.developerNotes.trim()}"\n`;
        }
    }

    if (notesText) {
        content += `\n\n[KULLANICI SEÇİMLERİ & ÖNCEKİ ADIM MANUEL KARARLARI]:
Aşağıdaki kararlar bir önceki adımlarda kullanıcı tarafından verilmiştir. Bu bilgilere kaydet ve kodları bu standartlara/portlara göre entegre et:
${notesText}`;
    }

    // Always inject the custom file tree
    content += `\n\n[GÜNCEL HEDEF DOSYA HİYERARŞİSİ]:
Kodlama yaparken aşağıdaki dosya isimlendirmelerine ve klasör yapısına kesinlikle uyum sağlayın:
"""
${buildAsciiFileTree()}
"""`;

    return content;
}

// --- DYNAMIC STEP PROMPT SLICER ---
async function handleSliceStep(index) {
    const step = state.currentData.prompts[index];
    const subContainer = document.getElementById(`sub-steps-container-${index}`);
    
    subContainer.classList.remove('hidden');
    subContainer.innerHTML = `<div class="loader-circle" style="width:20px;height:20px;border-width:2.5px;margin:1rem auto;"></div><p style="font-size:0.8rem;text-align:center;color:var(--text-muted);">Adım analiz ediliyor ve 3 alt parçaya bölünüyor...</p>`;

    try {
        let response;
        if (state.apiKey && state.apiKey.length > 10) {
            response = await sliceStepWithGemini(step);
        } else {
            await sleep(1500);
            response = sliceStepOffline(step, index + 1);
        }

        state.currentData.prompts[index].subSteps = response.subSteps;
        renderSubStepsUI(index, response.subSteps);
        
        state.historyStack.push({
            messages: JSON.parse(JSON.stringify(state.messages)),
            currentData: JSON.parse(JSON.stringify(state.currentData))
        });
        updateUndoButtonVisibility();
        
        saveCurrentProjectState();
        showToast(`Adım ${index + 1} alt parçalara başarıyla bölündü!`);

    } catch (error) {
        console.error(error);
        showToast('Adım bölünemedi.', true);
        subContainer.classList.add('hidden');
    }
}

// Render Sliced Sub Steps UI
function renderSubStepsUI(stepIndex, subSteps) {
    const subContainer = document.getElementById(`sub-steps-container-${stepIndex}`);
    subContainer.classList.remove('hidden');
    subContainer.innerHTML = '';

    const titleEl = document.createElement('div');
    titleEl.className = 'sub-steps-title';
    titleEl.innerHTML = `<i data-lucide="split"></i><span>Alt Geliştirme Adımları (Bölünmüş Yönergeler)</span>`;
    subContainer.appendChild(titleEl);

    subSteps.forEach((sub, subIdx) => {
        const card = document.createElement('div');
        card.className = 'sub-step-card';
        card.innerHTML = `
            <div class="sub-step-header">
                <h5>${escapeHTML(sub.title)}</h5>
                <button class="btn btn-secondary btn-small btn-copy-sub" data-step="${stepIndex}" data-sub="${subIdx}">
                    <i data-lucide="copy" style="width:12px;height:12px;margin-right:2px;"></i>Kopyala
                </button>
            </div>
            <pre class="sub-step-body"><code>${escapeHTML(sub.content)}</code></pre>
        `;

        card.querySelector('.btn-copy-sub').addEventListener('click', () => {
            copyTextToClipboard(sub.content);
        });

        subContainer.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons();
}

// Slice Step with Gemini API
async function sliceStepWithGemini(step) {
    const promptText = `
Sen uzman bir Yapay Zeka Sistem Mimarısın. Sana verilecek olan büyük bir yazılım geliştirme promptunu, sırayla kopyalanıp yapay zeka kodlama ajanına (Cursor/Windsurf) verilebilecek **3 adet mantıksal alt-prompta (bölüme)** ayırmalısın.

ANA PROMPT ADI: "${step.title}"
AÇIKLAMASI: "${step.description}"
PROMPT İÇERİĞİ:
"""
${step.content}
"""

Her bir alt adım promptunun başına [BAĞLAM HARİTASI (CONTEXT MAP)] ve sonuna [KABUL KRİTERLERİ] kısımlarını açık ve detaylı şekilde ekle.

Yanıtını AŞAĞIDAKİ JSON formatında dön:
{
  "subSteps": [
    {
      "title": "Adım X.1: Alt Bölüm Adı",
      "content": "Ajanın doğrudan kopyalayıp çalıştıracağı ultra detaylı, context haritalı ve test kriterli alt prompt içeriği."
    },
    {
      "title": "Adım X.2: Alt Bölüm Adı",
      "content": "..."
    },
    {
      "title": "Adım X.3: Alt Bölüm Adı",
      "content": "..."
    }
  ]
}

Tüm çıktıları Türkçe ver.
`;

    try {
        const textResponse = await LLMProvider.generateContent(promptText, state.apiKey, true);
        return JSON.parse(textResponse);
    } catch (err) {
        console.error("Gemini API parsing/validation error in sliceStepWithGemini:", err);
        throw err;
    }
}

// Slice Step Offline Simulator
function sliceStepOffline(step, stepNum) {
    const subSteps = [
        {
            title: `Adım ${stepNum}.1: Çekirdek Yapılandırma ve Tanımlar`,
            content: `Sen uzman bir Yazılım Geliştiricisisin.
Görev: "${step.title}" adımının ilk parçası olarak gerekli veri modellerini, import satırlarını ve konfigürasyon tanımlamalarını oluştur.

[DOSYA BAĞLAM HARİTASI (CONTEXT MAP)]
- Okunacak: [state.md]
- Oluşturulacak/Değiştirilecek: [app.js]

[KABUL KRİTERLERİ]
- Test 1: Tanımlamaların syntax hatası vermediğini konsoldan doğrula.
- Test 2: state.md dosyasına Adım ${stepNum}.1 başladı durumunu ekle.`
        },
        {
            title: `Adım ${stepNum}.2: Mantıksal Akışların ve Logic Metotların Yazılması`,
            content: `Sen uzman bir Yazılım Geliştiricisisin.
Görev: "${step.title}" adımının ikinci parçası olarak gerekli tüm işlevsel fonksiyonları ve asenkron veri servislerini yaz.

[DOSYA BAĞLAM HARİTASI (CONTEXT MAP)]
- Okunacak: [app.js, state.md]
- Oluşturulacak/Değiştirilecek: [app.js]

[KABUL KRİTERLERİ]
- Test 1: Yazılan fonksiyonların veri dönüş tiplerini (null-safety) kontrol et.
- Test 2: state.md dosyasına Adım ${stepNum}.2 durumunu tamamlandı olarak işaretle.`
        },
        {
            title: `Adım ${stepNum}.3: Arayüz Bağlantıları ve Entegrasyon Testleri`,
            content: `Sen uzman bir Yazılım Geliştiricisisin.
Görev: "${step.title}" adımının son parçası olarak fonksiyonları UI event listener tetikleyicilerine bağla ve veri testlerini yap.

[DOSYA BAĞLAM HARİTASI (CONTEXT MAP)]
- Okunacak: [index.html, style.css, app.js, state.md]
- Oluşturulacak/Değiştirilecek: [index.html, app.js]

[KABUL KRİTERLERİ]
- Test 1: Kullanıcı arayüzünde verilerin hatasız render edildiğini kontrol et.
- Test 2: state.md dosyasındaki ana Adım ${stepNum} kutusunu tamamlandı [x] olarak işaretle.`
        }
    ];

    return { subSteps };
}

// --- SKILL.MD SECTIONS MODULAR FILTER ---
function getFilteredSkillMarkdown() {
    if (!state.currentData || !state.currentData.skillMarkdown) return '';
    
    const rawText = state.currentData.skillMarkdown;
    const showUi = document.getElementById('skill-sec-ui').checked;
    const showSecurity = document.getElementById('skill-sec-security').checked;
    const showTesting = document.getElementById('skill-sec-testing').checked;
    const showLogging = document.getElementById('skill-sec-logging').checked;
    
    const parts = rawText.split('\n## ');
    const header = parts[0];
    
    const filteredParts = parts.slice(1).filter(part => {
        const lowerPart = part.toLowerCase();
        
        if (lowerPart.includes('tasarım') || lowerPart.includes('ui') || lowerPart.includes('buton') || lowerPart.includes('arayüz') || lowerPart.includes('görsel')) {
            return showUi;
        }
        if (lowerPart.includes('güvenlik') || lowerPart.includes('security') || lowerPart.includes('xss') || lowerPart.includes('sanitize') || lowerPart.includes('csrf')) {
            return showSecurity;
        }
        if (lowerPart.includes('test') || lowerPart.includes('qa') || lowerPart.includes('doğrulama') || lowerPart.includes('kriter')) {
            return showTesting;
        }
        if (lowerPart.includes('hata') || lowerPart.includes('log') || lowerPart.includes('logger') || lowerPart.includes('durum takibi') || lowerPart.includes('state')) {
            return showLogging;
        }
        return true;
    });
    
    if (filteredParts.length === 0) return header;
    return header + '\n## ' + filteredParts.join('\n## ');
}

// --- RENDER DYNAMIC SUBAGENTS ---
function renderDynamicSubagents(subagents) {
    elements.subagentSelectorContainer.innerHTML = '';

    if (Array.isArray(subagents) && subagents.length > 0) {
        const keys = subagents.map(s => s.key);
        if (!keys.includes(state.activeSubagentKey)) {
            state.activeSubagentKey = keys[0];
        }

        subagents.forEach(agent => {
            const btn = document.createElement('button');
            btn.className = `subagent-btn ${state.activeSubagentKey === agent.key ? 'active' : ''}`;
            btn.setAttribute('data-agent', agent.key);
            
            let iconName = 'layout-template';
            if (agent.key.includes('db') || agent.key.includes('backend') || agent.key.includes('sql') || agent.key.includes('server')) iconName = 'server';
            if (agent.key.includes('security') || agent.key.includes('test') || agent.key.includes('qa') || agent.key.includes('audit')) iconName = 'shield-check';
            if (agent.key.includes('game') || agent.key.includes('unity') || agent.key.includes('physics') || agent.key.includes('mechanic')) iconName = 'gamepad-2';
            
            btn.innerHTML = `
                <i data-lucide="${iconName}"></i>
                <span>${escapeHTML(agent.role)}</span>
            `;
            
            btn.addEventListener('click', () => {
                document.querySelectorAll('.subagent-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.activeSubagentKey = agent.key;
                displayActiveSubagent();
            });

            elements.subagentSelectorContainer.appendChild(btn);
        });

        displayActiveSubagent();
    }
}

// --- EDITOR RULES VIEW UPDATE ---
function updateEditorRulesView() {
    if (!state.currentData) return;
    
    const editor = state.activeEditor;
    let ruleText = '';
    let filename = '.cursorrules';
    
    if (editor === 'cursor') {
        ruleText = state.currentData.cursorRules;
        filename = '.cursorrules';
    } else if (editor === 'windsurf') {
        ruleText = state.currentData.windsurfRules || state.currentData.cursorRules;
        filename = '.windsurfrules';
    } else if (editor === 'copilot') {
        ruleText = state.currentData.copilotRules || state.currentData.cursorRules;
        filename = 'copilot-instructions.md';
    }
    
    elements.cursorFilename.textContent = filename;
    elements.cursorCode.textContent = ruleText;
    elements.btnDownloadCursorText.textContent = `${filename} Dosyasını İndir`;
}

function displayActiveSubagent() {
    if (!state.currentData || !state.currentData.subagents) return;
    
    const agent = state.currentData.subagents.find(s => s.key === state.activeSubagentKey);
    if (agent) {
        elements.subagentCode.textContent = agent.prompt;
        elements.subagentFilename.textContent = agent.filename;
    }
}

// --- OFFLINE CONFIG ARTIFACTS GENERATOR ---
function generateOfflineArtifacts(refinedIdea, type, priorities) {
    const detectedStack = state.techStack;
    const stepCount = state.stepDepth;
    const prompts = [];
    
    for (let i = 1; i <= stepCount; i++) {
        let title = `Adım ${i}: Proje Geliştirme Akışı`;
        let description = `Adım ${i} için teknoloji yığını ve kod standartlarının kodlatılması.`;
        
        let recommendedModel = "Claude 3.5 Sonnet (Yüksek UI)";
        if (i % 2 === 0) recommendedModel = "GPT-4o mini (Hızlı Kod)";
        
        if (i === 1) {
            title = "Adım 1: Proje Temeli, Core Design System ve Klasör Yapısı";
            description = "Teknoloji şemasına göre temel yapıların, dizinlerin ve ortak sınıfların/CSS kurallarının kurulması.";
            recommendedModel = "Claude 3.5 Sonnet (Arayüz & Yapı)";
        } else if (i === stepCount) {
            title = `Adım ${stepCount}: Görsel Cilalama, Hata Kontrolleri ve Son Testler`;
            description = "Yumuşak geçiş efektleri, mock-testler ve try-catch hata yakalama yapılarının tamamlanması.";
            recommendedModel = "Claude 3.5 Sonnet (Kreatif UI)";
        } else if (i === 2) {
            title = "Adım 2: Veri Servis Modeli ve State Servislerinin Yazılması";
            description = "Projenin veri akış modellerinin ve lokal/servis state yapısının kodlanması.";
            recommendedModel = "GPT-4o mini (Hızlı Veri/Servis)";
        } else {
            title = `Adım ${i}: İşlevsel Özelliklerin ve Logic Entegrasyonunun Kodlanması (Bölüm ${i - 2})`;
            description = `Proje gereksinimlerinin mantıksal ve fonksiyonel bileşenlerinin kurulması.`;
        }

        prompts.push({
            title,
            description,
            recommendedModel,
            content: `Sen uzman bir Arayüz Tasarımcısı ve Yazılım Mimarı Yapay Zeka Ajanısın.
Görev: "${title}" adımının kodlanması.

[ÖN KOŞULLAR & DURUM GEÇİŞ KAPILARI (STATE GATES)]
- Bu adıma başlamadan önce bir önceki adımdaki dosyaların ve ana state yapısının derleme hatası vermediğini konsoldan doğrulayın.

[DOSYA BAĞLAM HARİTASI (CONTEXT MAP)]
- Teknoloji: ${detectedStack}
- Okunacak Dosyalar: [state.md, TASARIM_MİMARİSİ.md]
- Değiştirilecek/Oluşturulacak Dosyalar: [app.js, style.css]

[KABUL KRİTERLERİ & DOĞRULAMA SENARYOLARI]
- Test 1: Kodun hatasız derlendiğini tarayıcı konsolundan doğrulayın.
- Test 2: state.md dosyasındaki 'Adım ${i}' maddesini tamamlandı [x] olarak işaretleyin.
- CLI Doğrulama: npm run lint`
        });
    }

    let customDebugRule = "";
    if (refinedIdea.toLowerCase().includes("[si̇stem geri̇ besleme]")) {
        customDebugRule = `\n## Proje Hata Düzeltme Kuralları (Geri Besleme)\n- Önceki hata çözümlerinden yola çıkarak: CORS ayarları kontrol edilmeli, API isteklerinde baseURL doğru kurgulanmalı ve null/undefined olma ihtimali olan dizilerde map() fonksiyonundan önce koruma (|| []) eklenmelidir.`;
    }

    // Offline version-specific rules
    let guardRules = "";
    if (state.techVersion === 'react-19') {
        guardRules = "\n## React 19 API Kılavuzu:\n- form elemanlarında action attribute'u kullanın, useActionState hookunu tercih edin.";
    } else if (state.techVersion === 'next-15') {
        guardRules = "\n## Next.js 15 API Kılavuzu:\n- Page params ve searchParams artık asenkrondur (await params şeklinde çözülmelidir).";
    } else if (state.techVersion === 'unity-6') {
        guardRules = "\n## Unity 6 API Kılavuzu:\n- Yeni URP Render Graph API'sini kullanın, eski Render Pipeline methodlarını çağırırsanız hata alırsınız.";
    }

    const skillMarkdown = `# Proje Geliştirme Yönergesi (SKILL.md)

## Proje Tanımı
${refinedIdea}

## Teknolojik Standartlar
- **Platform**: ${type.toUpperCase()}
- **Teknoloji Yığını**: ${detectedStack} (Sürüm: ${state.techVersion})
${guardRules}

## Tasarım Kuralları
${priorities.ui ? `- Arayüzde kesinlikle standart tarayıcı butonları kullanılmayacak, özelleştirilmiş cam efektli butonlar yazılacaktır.\n` : ''}- Tasarımda modern flex/grid yerleşimleri kullanılacak, responsive uyum tam sağlanacaktır.

## Güvenlik Yönergeleri
${priorities.security ? `- Tüm kullanıcı girdileri XSS ve SQL Injection'a karşı sanitize edilmeden asla işlenmeyecektir.\n` : ''}- Hassas kimlik doğrulama belirteçleri (tokens) kodun içine düz metin olarak yazılmayacaktır.

## Test & QA Standartları
- Geliştirilen her bileşenin mock testleri yazılacaktır.
- Kabul kriterlerindeki doğrulama adımları çalıştırılmadan kod tamamlandı sayılmayacaktır.

## Hata Yönetimi & Loglama
- Tüm asenkron API çağrılarında try-catch blokları ve kullanıcı dostu hata mesajları kullanılmalıdır.
- **DURUM TAKİBİ**: Kod yazarken her adımın başında ve sonunda mutlaka projenin kök dizinindeki 'state.md' dosyasını oku ve güncelle. Adım tamamlanmadan bir sonrakine geçme.
${customDebugRule}
`;

    // Offline architecture blueprints
    let architectureMarkdown = `# Mimari Plan ve Sistem Şeması (TASARIM_MİMARİSİ.md)

Bu dosya, projenin en ince detayına kadar kurgulanmış yazılım mimarisini temsil eder.

## 🏛️ Mimari Tasarım & Kalıplar
- **Model-View-Controller (MVC) / Modüler Katmanlı Yapı**: UI katmanı veri servislerinden kesinlikle izole edilecektir.
- **Sürüm Koruması**: ${state.techVersion.toUpperCase()}

## ⛓️ Dosya İlişkileri ve İçe Aktarma Matrisi (Dependency Matrix)
- Ana modül: \`app.js\` (Uygulamanın başlangıç noktası)
- Görsel tasarım: \`style.css\`

## 🛡️ Güvenlik & Validasyon Standartları
- XSS koruması için raw HTML çıktıları sanitize edilmelidir.
- Durum doğrulaması için her girdinin minimum/maksimum uzunlukları denetlenmelidir.

## 🔍 Uç Durumlar ve Hata Toleransı
- **Ağ Kesintileri**: API istekleri düştüğünde arayüzde bir hata kutusu gösterilmeli ve istek 3 saniye sonra otomatik tekrarlanmalıdır.
`;

    let fileTree = [];
    let mermaidCode = "";

    if (type === 'game' || detectedStack.toLowerCase().includes('unity')) {
        fileTree = [
            { path: "Assets", type: "folder", description: "Oyun dosyaları kökü" },
            { path: "Assets/Scripts", type: "folder", description: "C# Scriptleri" },
            { path: "Assets/Scripts/InventoryManager.cs", type: "file", description: "Envanter logic sınıfı" },
            { path: "Assets/Scripts/InventoryUI.cs", type: "file", description: "Arayüz görsel yönetim" },
            { path: "Assets/Scripts/ItemData.cs", type: "file", description: "ScriptableObject item şablonu" },
            { path: "Assets/Prefabs", type: "folder", description: "Oyun prefab şablonları" }
        ];

        mermaidCode = `stateDiagram-v2
    [*] --> Closed
    Closed --> Opened : TogglePress
    Opened --> DraggingItem : DragStart
    DraggingItem --> Crafting : DropOnCraftSlot
    Crafting --> Opened : CraftSuccess
`;

        architectureMarkdown = `# Oyun Mekanikleri Mimari Tasarımı (TASARIM_MİMARİSİ.md)

## 🎮 Oyun Döngüsü & Mantığı
- **GameLoop Entegrasyonu**: Tüm physics ve rigidbody güncellemeleri \`FixedUpdate\` içinde, diğer kontroller ise \`Update\` içinde çalışacaktır.
- **Genişletilebilirlik**: Item veya düşman özellikleri için \`ScriptableObjects\` mimarisi tercih edilecektir.
- **Sürüm Standardı**: ${state.techVersion} URP Render graph kuralları uygulanacaktır.

## ⛓️ Modül Bağımlılık Matrisi
- UI Scriptleri, Logic modüllerine olay tabanlı (Action / Event) olarak abone olmalı; doğrudan referans içermemelidir (Decoupling).

## ⚡ Performans ve Bellek (GC) Optimizasyonları
- Sık üretilen mermiler veya item görselleri için **Object Pooling (Nesne Havuzlama)** kullanılacaktır.
`;
    } else {
        fileTree = [
            { path: "src", type: "folder", description: "Uygulama kodları kökü" },
            { path: "src/components", type: "folder", description: "UI Elemanları" },
            { path: "src/components/Dashboard.tsx", type: "file", description: "Görsel grafik tablosu" },
            { path: "src/services", type: "folder", description: "Veri Servisleri" },
            { path: "src/services/api.ts", type: "file", description: "Mock veri ve API bağlantısı" },
            { path: "src/app.css", type: "file", description: "Global css ve tema değişkenleri" }
        ];

        mermaidCode = `erDiagram
    USER ||--o{ POST : writes
    POST ||--o{ COMMENT : has
`;
    }

    const cursorRules = `# .cursorrules - Proje Kuralları ve Standartları (${detectedStack})

Bu proje bir **${type.toUpperCase()}** projesidir.

## Ajan Davranışları
- Kod yazmadan önce mutlaka mevcut dosya yapısını analiz et.
- **BELLEK YÖNETİMİ**: Çalışmaya başlamadan önce 'state.md' dosyasını okuyarak aktif çalışma adımını gör. Adım bittiğinde durumunu 'state.md' dosyasına işle.

## Stil ve Kod Standartları (Teknoloji: ${detectedStack})
- ${priorities.ui ? 'Modern, koyu tema odaklı ve geçiş efektleri olan premium UI öğeleri yaz.' : 'Okunabilir, temiz kod yaz.'}
- Değişken ve dosya isimlendirmelerinde camelCase tercih et.

## Güvenlik ve Performans
- ${priorities.security ? 'XSS ve CSRF açıklarına karşı verileri sanitize et. Hassas anahtarları koda yazma.' : 'Güvenli kod standartlarına uy.'}
- ${priorities.performance ? 'Asenkron fonksiyonlarda try-catch kullan, gereksiz döngüleri engelle.' : 'Asenkron akışları doğru yönet.'}
${customDebugRule}
`;

    const windsurfRules = `# .windsurfrules - Windsurf Ajan Standartları (${detectedStack})

## Windsurf Yönergeleri
- Editör özellikleri ve otomatik tamamlamaları en aktif şekilde kullan.
- state.md bellek takibi kurallarına uyun.

## Teknoloji & Mimari
- Dil: ${detectedStack}
${customDebugRule}
`;

    const copilotRules = `# Copilot Instructions (instructions.md) - ${detectedStack}

Bu dosya GitHub Copilot ajanının projeyi geliştirmesi için tasarlanmıştır.

## Talimatlar
- Projenin kodlama yapısı: ${detectedStack}
- state.md dosyasındaki adımları ve test kabul kriterlerini sırasıyla yerine getirin.
${customDebugRule}
`;

    let stepChecklists = '';
    for (let i = 1; i <= stepCount; i++) {
        if (i === 1) stepChecklists += `- [ ] Adım 1: Proje Temeli, Core Design System ve Klasör Yapısı\n`;
        else if (i === stepCount) stepChecklists += `- [ ] Adım ${stepCount}: Görsel Cilalama ve Son Testler\n`;
        else if (i === 2) stepChecklists += `- [ ] Adım 2: Veri Servis Modeli ve State Servisleri\n`;
        else stepChecklists += `- [ ] Adım ${i}: İşlevsel Özelliklerin Kodlanması (Bölüm ${i - 2})\n`;
    }

    const stateMarkdown = `# Çalışma Alanı Durum Dosyası (state.md)

Bu dosya, yapay zeka kodlama ajanınızın (Cursor/Windsurf vb.) proje boyunca nerede kaldığını takip edebilmesi ve hafıza kaybı yaşamaması için hazırlanmıştır.
**AJAN TALİMATI**: Her geliştirme adımının başında ve sonunda bu dosyayı oku, işaretlemeleri güncelle ve yapılanları kaydet.

## Proje Tanımı
- **Adı**: ${refinedIdea.substring(0, 40)}...
- **Platform**: ${type.toUpperCase()}
- **Teknoloji Yığını**: ${detectedStack}

## İlerleme Planı (Tam Durum)
${stepChecklists}
## Aktif Çalışma Adımı
- Henüz Başlanmadı

## Son Yapılan Değişiklikler
- Proje dosyaları AI-Architect tarafından kurgulandı.

## Bilinen Hatalar ve Yapılacaklar
- (Ajan çalışma esnasında karşılaştığı çözülmemiş sorunları buraya yazmalıdır)
`;

    let subagents = [];
    if (type === 'game' || detectedStack.toLowerCase().includes('unity') || detectedStack.toLowerCase().includes('c#')) {
        subagents = [
            {
                key: "unity",
                role: "Unity C# Geliştiricisi",
                filename: "unity_agent.txt",
                prompt: `Sen uzman bir Unity C# oyun geliştirici ajansın. Proje: "${refinedIdea}". SOLID kurallarına uy, C# Garbage Collector optimizasyonları yap ve physics güncellemelerini FixedUpdate içine yaz.`
            },
            {
                key: "physics",
                role: "Fizik & Mekanik Uzmanı",
                filename: "physics_agent.txt",
                prompt: `Sen Unity fizik motoru ve oyun mekanik uzmanı ajansın. Karakter hareketleri ve Rigidbody etkileşimlerini hatasız kodla.`
            },
            {
                key: "qa",
                role: "Performans & QA Ajanı",
                filename: "perf_qa_agent.txt",
                prompt: `Sen oyun performans optimizasyon ve QA test ajanısın. FPS droplarını engelle, memory leakleri tespit et.`
            }
        ];
    } else {
        subagents = [
            {
                key: "frontend",
                role: "UI & Frontend Ajanı",
                filename: "ui_agent.txt",
                prompt: `Sen uzman bir UI/UX ve Frontend geliştirici ajansın. Premium CSS, responsive grid ve cam efektleri yaz. Teknoloji: ${detectedStack}`
            },
            {
                key: "backend",
                role: "Backend & API Sorumlusu",
                filename: "backend_agent.txt",
                prompt: `Sen uzman bir Backend, DB ve API mimarı ajansın. RESTful endpointleri, veritabanı validasyonlarını kodla. Teknoloji: ${detectedStack}`
            },
            {
                key: "security",
                role: "Güvenlik & QA Denetçisi",
                filename: "security_agent.txt",
                prompt: `Sen uzman bir Güvenlik ve QA denetçi ajansın. SQL injection, XSS açıklarını kapat ve exception handling mekanizmasını test et.`
            }
        ];
    }

    const docs = {
        brief: `# PROJE ÖZETİ (PROJECT_BRIEF.md)\n\n## Proje Tanımı\n${refinedIdea}\n\n## Hedefler ve Değer Önerisi\n- Basit ve ölçeklenebilir kod tasarımı.\n- Local-first ve yüksek performans.\n`,
        requirements: `# ÜRÜN GEREKSİNİMLERİ (REQUIREMENTS.md)\n\n## 1. Must Have (Kritik)\n- Fikir girişi ve temel durum takibi.\n- Kodlama ajanı için entegre kural dosyası.\n\n## 2. Should Have (Önemli)\n- ZIP formatında export.\n- Proje hafıza sekmeleri.\n`,
        architecture: architectureMarkdown,
        tech_stack: `# TEKNOLOJİ YIĞINI (TECH_STACK.md)\n\n## Çekirdek Kütüphaneler\n- Platform: ${type.toUpperCase()}\n- Dil/Framework: ${detectedStack} (Sürüm: ${state.techVersion})\n`,
        risks: `# RİSK ANALİZİ VE ÖNLEMLER (RISKS.md)\n\n## 1. Veri Kaybı Riski\n- *Önlem:* Üzerine yazmadan önce diff gösterimi ve atomic yazma.\n`,
        state_md: stateMarkdown
    };

    const decisions = [
        { id: "DEC-001", title: "Katmanlı Mimari Yapısı", decision: "Domain katmanını altyapıdan tamamen ayırma.", reason: "Gelecekte CLI veya Cloud geçişini kolaylaştırma." },
        { id: "DEC-002", title: "Local-First Veri Depolama", decision: "Proje listesini SQLite / LocalStorage üzerinde tutma.", reason: "Hızlı, offline çalışabilen ve sunucu bağımsız yapı." }
    ];

    const assumptions = [
        { id: "ASM-001", text: "Kullanıcılar uygulamayı lokalde veya offline modda kullanabilir.", confidence: "high", status: "active" },
        { id: "ASM-002", text: "Üretilen ZIP paketleri popüler IDE'lerde (VS Code, Cursor) doğrudan açılacaktır.", confidence: "high", status: "active" }
    ];

    const risks = [
        { id: "RSK-001", title: "Büyük dosya taramalarında token aşımı", probability: "medium", impact: "high", mitigation: "Varsayılan ignore (.gitignore) kurallarını katı şekilde uygulama." }
    ];

    const openQuestions = [
        { id: "Q-001", question: "İleride Git reposu otomatik oluşturulsun mu?", importance: "low" }
    ];

    const findings = [
        { id: "FND-001", title: "Sürüm Koruması Aktif", severity: "info", message: `Seçilen teknoloji sürümü (${state.techVersion}) koruma altına alındı.`, mitigation: "Ajan promptlarında kurallar kilitlendi." },
        { id: "FND-002", title: "Çevrimdışı Mod Çalışıyor", severity: "info", message: "Planlayıcı çevrimdışı şablon modunda çalışmaktadır.", mitigation: "API anahtarı girildiğinde canlı planlamaya geçilir." }
    ];

    let workflowStage = 'IDEA_CAPTURED';
    if (state.messages.length > 4) {
        workflowStage = 'READY_FOR_EXPORT';
    } else if (state.messages.length > 2) {
        workflowStage = 'SCOPE_DRAFTED';
    } else if (state.messages.length > 0) {
        workflowStage = 'DISCOVERY_IN_PROGRESS';
    }

    return {
        prompts,
        docs,
        cursorRules,
        windsurfRules,
        copilotRules,
        subagents,
        fileTree,
        decisions,
        assumptions,
        risks,
        openQuestions,
        healthScore: 85,
        findings,
        workflowStage,
        skillMarkdown
    };
}

// --- INTERACTIVE DEBUGGER SOLVER ---
async function handleSolveDebug() {
    const errorLog = elements.debuggerError.value.trim();
    const errorCode = elements.debuggerCode.value.trim();
    
    if (!errorLog) {
        showToast('Lütfen hata logunu girin!', true);
        return;
    }

    elements.debuggerSolutionSection.classList.add('hidden');
    elements.btnSolveDebug.disabled = true;
    elements.btnSolveDebug.innerHTML = `<span class="loader-circle" style="width:16px;height:16px;border-width:2px;margin-bottom:0;display:inline-block;vertical-align:middle;margin-right:8px;"></span>Çözüm Arıyor...`;

    try {
        let solution;
        if (state.apiKey && state.apiKey.length > 10) {
            solution = await solveDebugWithGemini(errorLog, errorCode);
        } else {
            await sleep(1000);
            solution = solveDebugOffline(errorLog);
        }

        elements.debuggerExplanation.textContent = solution.explanation;
        elements.debuggerSolutionCode.textContent = solution.solutionPrompt;
        elements.debuggerSolutionSection.classList.remove('hidden');

    } catch (error) {
        console.error(error);
        showToast('Hata çözüm promptu üretilemedi.', true);
    } finally {
        elements.btnSolveDebug.disabled = false;
        elements.btnSolveDebug.innerHTML = `<i data-lucide="bug"></i><span>Hata Çözüm Promptu Üret</span>`;
        if (window.lucide) window.lucide.createIcons();
    }
}

// --- GEMINI API: SOLVE DEBUG ---
async function solveDebugWithGemini(errorLog, errorCode) {
    const promptText = `
Sen uzman bir yazılım hata gidericisisin (debugger). Kullanıcının projesindeki hatayı analiz ederek, hatanın neden kaynaklandığını açıklayan kısa bir teknik açıklama ve kodlama ajanının hatayı tek seferde çözebilmesi için kopyalayacağı nokta atışı bir düzeltme promptu (hotfix prompt) hazırlamalısın.

PROJE BAĞLAMI: "${state.draftDescription}"
HATA LOGU: "${errorLog}"
HATALI KOD (Varsa): "${errorCode}"

Aşağıdaki JSON formatında yanıt ver:
{
  "explanation": "Hatanın neden kaynaklandığına dair kısa ve net teknik açıklama (Türkçe).",
  "solutionPrompt": "Ajanın hatayı çözmesi için kopyalayıp vereceği detaylı düzeltme promptu (Türkçe)."
}
`;

    try {
        const textResponse = await LLMProvider.generateContent(promptText, state.apiKey, true);
        return JSON.parse(textResponse);
    } catch (err) {
        console.error("Gemini API parsing/validation error in solveDebugWithGemini:", err);
        throw err;
    }
}

// --- OFFLINE DEBUG SOLVER ---
function solveDebugOffline(errorLog) {
    const err = errorLog.toLowerCase();
    let explanation = "Genel kod derleme veya mantıksal çalışma hatası algılandı.";
    let solutionPrompt = "";

    if (err.includes('cors')) {
        explanation = "CORS (Cross-Origin Resource Sharing) hatası. Tarayıcı, güvenlik gerekçesiyle farklı bir kökenden (origin) gelen API isteklerini engelliyor.";
        solutionPrompt = `CORS HATASI DÜZELTME PROMPTU:
Sen kıdemli bir backend geliştiricisisin. Uygulamada CORS hatası alıyoruz: "${errorLog}".
Lütfen backend tarafındaki CORS ayarlarını düzenle. İstemci adresinden gelen isteklere (Origin) izin ver. HTTP response header alanına Access-Control-Allow-Origin: * (veya spesifik istemci adresi) başlığını ekle.`;
    } else if (err.includes('undefined') || err.includes('null') || err.includes('cannot read properties')) {
        explanation = "Tanımsız değer (Null Pointer / Undefined) erişim hatası. Kodun içinde null veya undefined olan bir değişkenin alt özelliklerine (özellikle map, length vb.) erişilmeye çalışılıyor.";
        solutionPrompt = `UNDEFINED/NULL HATASI DÜZELTME PROMPTU:
Uygulamada şu undefined/null hatasını alıyoruz: "${errorLog}".
Lütfen hata veren değişkenleri kontrol et. Veri çekilirken veya state yüklenirken değişkenin null/undefined olma durumuna karşı opsiyonel zincirleme (?.) veya varsayılan değer tanımlamaları (|| []) ekle. Hatanın gerçekleştiği yerlerde gerekli güvenlik kontrollerini yaz.`;
    } else if (err.includes('404')) {
        explanation = "API Endpoint bulunamadı (404 Not Found). İstek atılan URL adresi yanlış veya API tarafında bu route tanımlanmamış.";
        solutionPrompt = `404 BULUNAMADI HATASI DÜZELTME PROMPTU:
Uygulamada API isteklerinde 404 hatası alıyoruz.
Lütfen frontend tarafında istek atılan URL yapılandırmasını (baseURL, endpoints) kontrol et. Backend tarafındaki route tanımlarının ve port ayarlarının eşleştiğinden emin ol.`;
    } else {
        solutionPrompt = `GENEL HATA DÜZELTME PROMPTU:
Sen uzman bir hata gidericisin. Projemizde şu hatayı alıyoruz:
"${errorLog}"

Lütfen bu hatayı analiz et, hatanın hangi dosyada gerçekleştiğini saptayarak gerekli kod düzeltmelerini yap ve hatanın bir daha tekrarlanmaması için koruyucu kod blokları (try-catch, validasyonlar) ekle.`;
    }

    return { explanation, solutionPrompt };
}

// --- FEEDBACK LOOP: INTEGRATE SOLVED BUG RULES ---
async function feedDebugToArchitect() {
    const errorLog = elements.debuggerError.value.trim();
    const solution = elements.debuggerSolutionCode.textContent.trim();
    
    if (!errorLog || !solution) return;
    
    elements.debuggerError.value = '';
    elements.debuggerCode.value = '';
    elements.debuggerSolutionSection.classList.add('hidden');
    
    state.messages.push({
        role: 'user',
        content: `[SİSTEM GERİ BESLEME]: Geliştirici kod yazarken şu hata ile karşılaştı: "${errorLog}". Hata şu şekilde çözüldü: "${solution}". Lütfen bu hata çözümünü projenin kurallarına enjekte et, .cursorrules ve SKILL.md dosyalarını bu hatayı bir daha yapmayacak şekilde güncelle.`
    });
    
    elements.chatTypingIndicator.classList.remove('hidden');
    elements.tabs[0].click(); 
    scrollChatToBottom();
    
    try {
        let result;
        if (state.apiKey && state.apiKey.length > 10) {
            result = await sendChatMessageToGemini();
        } else {
            await sleep(1500);
            result = generateOfflineConversationalResponse('[sistem geri besleme]');
        }
        
        state.messages.push({ role: 'model', content: result.chatResponse });
        state.currentData = result.projectFiles;
        
        renderChatMessages();
        displayResults(state.currentData);
        
        state.historyStack.push({
            messages: JSON.parse(JSON.stringify(state.messages)),
            currentData: JSON.parse(JSON.stringify(state.currentData))
        });
        updateUndoButtonVisibility();

        saveCurrentProjectState();
        showToast('Kural başarıyla mimari dosyalara entegre edildi!');
        
    } catch (error) {
        console.error(error);
        showToast('Geri besleme hatası!', true);
    } finally {
        elements.chatTypingIndicator.classList.add('hidden');
        scrollChatToBottom();
    }
}

// --- ZIP DOWNLOAD EXPORT ---
function downloadAllAsZip() {
    if (!state.currentData) {
        showToast('İndirilecek yapılandırma verisi yok!', true);
        return;
    }

    if (typeof window.JSZip === 'undefined') {
        showToast('JSZip kütüphanesi yüklenemedi. İnternet bağlantınızı kontrol edin.', true);
        return;
    }

    const zip = new window.JSZip();

    // 1. Root files
    zip.file("README.md", `# Project Architect AI - ${state.draftDescription.substring(0, 50)}...\n\nBu klasör otonom yapay zeka ajanları (Cursor, Claude Code, Cline vb.) için tasarlanmış kuralları, belgeleri ve görev listelerini barındırır.\n`);
    zip.file(".cursorrules", state.currentData.cursorRules || '');
    zip.file(".windsurfrules", state.currentData.windsurfRules || state.currentData.cursorRules || '');

    const copilotFolder = zip.folder(".github");
    copilotFolder.file("copilot-instructions.md", state.currentData.copilotRules || state.currentData.cursorRules || '');

    // 2. docs/ folder
    const docsFolder = zip.folder("docs");
    const docData = state.currentData.docs || {};
    docsFolder.file("PROJECT_BRIEF.md", docData.brief || '');
    docsFolder.file("REQUIREMENTS.md", docData.requirements || '');
    docsFolder.file("ARCHITECTURE.md", docData.architecture || '');
    docsFolder.file("TECH_STACK.md", docData.tech_stack || '');
    docsFolder.file("RISKS.md", docData.risks || '');
    docsFolder.file("TEST_STRATEGY.md", `# Test Stratejisi\n\n- Otomasyon testleri ve uç nokta (endpoint) doğrulama senaryoları.\n- Seçilen teknoloji yığını (${state.techStack}) için uygun test araçları.\n`);
    docsFolder.file("state.md", docData.state_md || state.currentData.stateMarkdown || '');

    // 3. tasks/ folder
    const tasksFolder = zip.folder("tasks");
    if (Array.isArray(state.currentData.prompts)) {
        state.currentData.prompts.forEach((step, index) => {
            const stepNum = index + 1;
            const taskStr = `# TASK-${String(stepNum).padStart(3, '0')} — ${step.title}\n\n## Amaç\n${step.description}\n\n## Yönerge\n${getInjectedPromptContent(index)}\n`;
            tasksFolder.file(`TASK-${String(stepNum).padStart(3, '0')}.md`, taskStr);
        });
    }

    // 4. rules/ folder
    const rulesFolder = zip.folder("rules");
    rulesFolder.file("general.md", `# Genel Kurallar\n\n- Dil standartları ve kod düzeni kuralları.\n${state.currentData.cursorRules || ''}`);
    rulesFolder.file("security.md", `# Güvenlik Standartları\n\n- SQL Injection ve XSS açıklarına karşı verilerin sanitize edilmesi.\n- Hassas kimlik doğrulama anahtarlarının gizlenmesi.\n`);
    rulesFolder.file("testing.md", `# Test Yazım Kuralları\n\n- Birim testleri (unit tests) ve entegrasyon testlerinin kapsam standartları.\n`);

    // 5. skills/ folder
    const skillsFolder = zip.folder("skills");
    const pArchSkillFolder = skillsFolder.folder("project-architect");
    pArchSkillFolder.file("SKILL.md", getFilteredSkillMarkdown());

    // 6. .project-architect/ folder
    const configFolder = zip.folder(".project-architect");
    configFolder.file("state.json", JSON.stringify({
        projectType: state.projectType,
        techStack: state.techStack,
        techVersion: state.techVersion,
        workflowStage: state.currentData.workflowStage || 'IDEA_CAPTURED',
        healthScore: state.currentData.healthScore || 85
    }, null, 2));
    
    configFolder.file("decisions.json", JSON.stringify(state.currentData.decisions || [], null, 2));
    configFolder.file("assumptions.json", JSON.stringify(state.currentData.assumptions || [], null, 2));
    configFolder.file("risks.json", JSON.stringify(state.currentData.risks || [], null, 2));

    const versionsFolder = configFolder.folder("versions");
    versionsFolder.file(".keep", "");
    const historyFolder = configFolder.folder("history");
    historyFolder.file(".keep", "");

    // 7. AGENTS.md (Consolidated subagents)
    let agentsMd = `# ALT AJANLAR (AGENTS.md)\n\n`;
    if (Array.isArray(state.currentData.subagents)) {
        state.currentData.subagents.forEach(agent => {
            agentsMd += `## Ajan: ${agent.role}\n- **Dosya:** \`subagents/${agent.filename}\`\n\n\`\`\`text\n${agent.prompt}\n\`\`\`\n\n`;
        });
    }
    zip.file("AGENTS.md", agentsMd);

    // 8. MASTER_PROMPT.md (All prompts overview)
    let masterPromptMd = `# BÜTÜNSEL PROMPT PLANI (MASTER_PROMPT.md)\n\n`;
    state.currentData.prompts.forEach((step, idx) => {
        masterPromptMd += `### Adım ${idx + 1}: ${step.title}\n\n${step.description}\n\n\`\`\`text\n${getInjectedPromptContent(idx)}\n\`\`\`\n\n`;
    });
    zip.file("MASTER_PROMPT.md", masterPromptMd);

    // 9. Build workspace skeleton
    const workspaceSkeletonFolder = zip.folder("workspace_skeleton");
    if (Array.isArray(state.currentData.fileTree)) {
        state.currentData.fileTree.forEach(item => {
            if (item.type === 'file') {
                workspaceSkeletonFolder.file(item.path, `// ${item.description || 'AI-Architect auto-generated file skeleton'}`);
            }
        });
    }

    // Generate ZIP
    zip.generateAsync({ type: "blob" }).then(content => {
        const url = URL.createObjectURL(content);
        const link = document.createElement("a");
        link.href = url;
        
        const safeTitle = state.draftDescription.substring(0, 15).replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
        link.download = `${safeTitle || 'proje'}_yapilandirmalari.zip`;
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('Toplu ZIP dosyası başarıyla indirildi!');
    }).catch(err => {
        console.error(err);
        showToast('ZIP sıkıştırma hatası!', true);
    });
}

// --- RESET CHAT SESSION ---
function resetChatSession() {
    state.chatStarted = false;
    state.projectId = null;
    state.draftDescription = '';
    state.messages = [];
    state.currentData = null;
    state.historyStack = [];

    elements.chatMessagesContainer.innerHTML = '';
    elements.projectDescription.value = '';
    elements.chatInputTextarea.value = '';
    elements.techStackInput.value = DEFAULTS.techStack;
    elements.techVersionSelect.value = DEFAULTS.techVersion;
    state.techStack = DEFAULTS.techStack;
    state.techVersion = DEFAULTS.techVersion;
    state.stepDepth = DEFAULTS.stepDepth;
    state.activeEditor = DEFAULTS.activeEditor;

    elements.depthBtns.forEach(btn => {
        const depthVal = btn.getAttribute('data-depth');
        btn.classList.toggle('active', depthVal === 'standard');
    });
    elements.rulesBtns.forEach(btn => {
        const editor = btn.getAttribute('data-editor');
        btn.classList.toggle('active', editor === DEFAULTS.activeEditor);
    });
    
    // Clear outputs
    elements.pipelineList.innerHTML = '';
    elements.skillCode.textContent = '';
    elements.cursorCode.textContent = '';
    elements.subagentCode.textContent = '';
    elements.fileTreeContainer.innerHTML = '';
    
    // Clear docs, memory, analyser, reviewer
    elements.docCode.textContent = '';
    elements.docFilename.textContent = '';
    elements.memoryDecisionsList.innerHTML = '';
    elements.memoryAssumptionsList.innerHTML = '';
    elements.healthScorePercentage.textContent = '85';
    elements.reviewerFindingsContainer.innerHTML = '';
    elements.analyserInputMeta.value = '';
    elements.analyserOutputSection.classList.add('hidden');
    elements.analyserSolutionCode.textContent = '';
    
    updateUndoButtonVisibility();
    
    toggleViews();
    showToast('Sohbet sıfırlandı, yeni kurulum yapabilirsiniz!');
}

// --- CLIPBOARD ACTIONS ---
function copyTextToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Panoya kopyalandı!');
    }).catch(err => {
        console.error(err);
        showToast('Kopyalama başarısız!', true);
    });
}

function copyAllPrompts() {
    if (!state.currentData || !state.currentData.prompts) return;
    const allText = state.currentData.prompts.map((step, idx) => {
        return `=== ADIM ${idx + 1}: ${step.title} ===\n\nAçıklama: ${step.description}\n\nPrompt:\n${getInjectedPromptContent(idx)}\n\n`;
    }).join('\n');
    copyTextToClipboard(allText);
}

function copySkillFile() {
    const text = getFilteredSkillMarkdown();
    if (text) copyTextToClipboard(text);
}

function downloadSkillFile() {
    const text = getFilteredSkillMarkdown();
    if (!text) return;
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "SKILL.md");
    elements.setupView.appendChild(link);
    link.click();
    elements.setupView.removeChild(link);
}

function copyCursorFile() {
    if (!state.currentData) return;
    const editor = state.activeEditor;
    let ruleText = '';
    
    if (editor === 'cursor') ruleText = state.currentData.cursorRules;
    else if (editor === 'windsurf') ruleText = state.currentData.windsurfRules || state.currentData.cursorRules;
    else if (editor === 'copilot') ruleText = state.currentData.copilotRules || state.currentData.cursorRules;

    copyTextToClipboard(ruleText);
}

function downloadCursorFile() {
    if (!state.currentData) return;
    
    const editor = state.activeEditor;
    let ruleText = '';
    let filename = '.cursorrules';
    
    if (editor === 'cursor') {
        ruleText = state.currentData.cursorRules;
        filename = '.cursorrules';
    } else if (editor === 'windsurf') {
        ruleText = state.currentData.windsurfRules || state.currentData.cursorRules;
        filename = '.windsurfrules';
    } else if (editor === 'copilot') {
        ruleText = state.currentData.copilotRules || state.currentData.cursorRules;
        filename = 'copilot-instructions.md';
    }

    const blob = new Blob([ruleText], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    elements.setupView.appendChild(link);
    link.click();
    elements.setupView.removeChild(link);
}

function copySubagentFile() {
    if (!state.currentData || !state.currentData.subagents) return;
    const agent = state.currentData.subagents.find(s => s.key === state.activeSubagentKey);
    if (agent) copyTextToClipboard(agent.prompt);
}

function copyDebugSolution() {
    const text = elements.debuggerSolutionCode.textContent;
    if (text) copyTextToClipboard(text);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// --- WORKFLOW STATUS UPDATER ---
function updateWorkflowTracker(stage) {
    const steps = ['IDEA_CAPTURED', 'DISCOVERY_IN_PROGRESS', 'SCOPE_DRAFTED', 'MVP_DEFINED', 'READY_FOR_EXPORT'];
    const currentIdx = steps.indexOf(stage);
    
    const trackerEl = document.getElementById('workflow-tracker');
    if (!trackerEl) return;
    
    const stepDivs = trackerEl.querySelectorAll('.tracker-step');
    const lineDivs = trackerEl.querySelectorAll('.tracker-line');
    
    stepDivs.forEach((div, idx) => {
        div.classList.remove('active', 'completed');
        if (idx === currentIdx) {
            div.classList.add('active');
        } else if (idx < currentIdx) {
            div.classList.add('completed');
        }
    });
    
    lineDivs.forEach((line, idx) => {
        line.classList.remove('active', 'completed');
        if (idx < currentIdx) {
            line.classList.add('completed');
        } else if (idx === currentIdx) {
            line.classList.add('active');
        }
    });
}

// --- PROJECT DOCUMENTS TAB CONTROLLERS ---
let activeDocKey = 'brief'; // 'brief', 'requirements', 'architecture', 'tech_stack', 'risks', 'state_md'

function updateProjectDocView() {
    if (!state.currentData || !state.currentData.docs) return;
    
    const text = getActiveDocText();
    const filename = getActiveDocFilename();
    
    elements.docFilename.textContent = filename;
    elements.docCode.textContent = text;
    elements.btnDownloadDocText.textContent = `${filename} Belgesini İndir`;
}

function getActiveDocText() {
    if (!state.currentData || !state.currentData.docs) return '';
    const docs = state.currentData.docs;
    if (activeDocKey === 'brief') return docs.brief || '';
    if (activeDocKey === 'requirements') return docs.requirements || '';
    if (activeDocKey === 'architecture') return docs.architecture || '';
    if (activeDocKey === 'tech_stack') return docs.tech_stack || '';
    if (activeDocKey === 'risks') return docs.risks || '';
    if (activeDocKey === 'state_md') return docs.state_md || '';
    return '';
}

function getActiveDocFilename() {
    if (activeDocKey === 'brief') return 'PROJECT_BRIEF.md';
    if (activeDocKey === 'requirements') return 'REQUIREMENTS.md';
    if (activeDocKey === 'architecture') return 'ARCHITECTURE.md';
    if (activeDocKey === 'tech_stack') return 'TECH_STACK.md';
    if (activeDocKey === 'risks') return 'RISKS.md';
    if (activeDocKey === 'state_md') return 'state.md';
    return 'DOCUMENT.md';
}

// --- PROJECT ANALYSER ---
async function handleRunAnalyser() {
    const inputMeta = elements.analyserInputMeta.value.trim();
    if (!inputMeta) {
        showToast('Lütfen proje yapısını veya package.json içeriğini girin!', true);
        return;
    }

    elements.analyserOutputSection.classList.add('hidden');
    elements.btnRunAnalyser.disabled = true;
    elements.btnRunAnalyser.innerHTML = `<span class="loader-circle" style="width:16px;height:16px;border-width:2px;margin-bottom:0;display:inline-block;vertical-align:middle;margin-right:8px;"></span>Analiz Ediliyor...`;

    try {
        await sleep(1500); // Simulate local processing
        
        let report = `# MEVCUT PROJE ANALİZ RAPORU\n\n`;
        let detected = "Bilinmeyen Yapı";

        if (inputMeta.includes('dependencies') || inputMeta.includes('react') || inputMeta.includes('package.json')) {
            detected = "React Web Projesi (npm / Node.js)";
            report += `## 🔍 Algılanan Ortam: React / Node.js Web Uygulaması\n
## ⚠️ Tespit Edilen Mimari Açıklar & Riskler:
1. **Sürüm Güncelliği:** React 18 kullanılıyor. React 19 ve Server Actions yetenekleri entegre edilmemiş (Teknik borç).
2. **Güvenlik Eksikliği:** İstemci tarafında çevresel değişkenler (.env) doğrudan sürece enjekte edilmiş, koruma filtresi eksik.
3. **Dokümantasyon:** Klasör yapısında otonom ajanlar için tasarlanmış \`state.md\` veya \`.cursorrules\` bulunmuyor.

## 🛠️ Önerilen Entegrasyon & Refactor Planı:
- **Görev 1 (Mimar):** Proje kök dizinine \`.cursorrules\` ve \`skills/project-architect/SKILL.md\` şablonlarını ekle.
- **Görev 2 (Refactor):** Hassas API anahtarlarını backend proxy katmanına taşı.
- **Görev 3 (Test):** Vitest test kütüphanesini projeye entegre et.`;
        } else if (inputMeta.includes('Assets') || inputMeta.includes('unity') || inputMeta.includes('cs')) {
            detected = "Unity C# Oyun Projesi";
            report += `## 🔍 Algılanan Ortam: Unity C# 2D/3D Oyun Projesi\n
## ⚠️ Tespit Edilen Mimari Açıklar & Riskler:
1. **Bellek Sızıntısı Riski:** Instantiation işlemleri oyun esnasında yapılıyor, Object Pooling sistemi kurulmamış.
2. **Mimari Bağımlılık:** UI bileşenleri ile veri sınıfları sıkı sıkıya bağlı (Tight Coupling).

## 🛠️ Önerilen Entegrasyon & Refactor Planı:
- **Görev 1:** Nesne havuzlama (Object Pooling) yönergelerini \`rules/game-performance.md\` dosyasına ekle.
- **Görev 2:** Event-driven arayüz haberleşmesini kur.`;
        } else {
            detected = "Genel Yazılım / Script Projesi";
            report += `## 🔍 Algılanan Ortam: Genel Yazılım / Script Projesi\n
## ⚠️ Tespit Edilen Mimari Açıklar & Riskler:
1. **İstisna Yönetimi (Exception Handling):** Hata durumlarında script çöküyor, otomatik kurtarma veya geri sarma mekanizması yok.
2. **Giriş Doğrulama:** Girdilerin boyut sınırları denetlenmemiş.

## 🛠️ Önerilen Entegrasyon & Refactor Planı:
- **Görev 1:** Try-catch hata toleransı yönergesini \`rules/general.md\` içerisine ekle.
- **Görev 2:** Adım promptlarına giriş validasyon testlerini yaz.`;
        }

        elements.analyserDetectionText.innerHTML = `<strong>Algılanan Yapı:</strong> ${escapeHTML(detected)}`;
        elements.analyserSolutionCode.textContent = report;
        elements.analyserOutputSection.classList.remove('hidden');
        showToast('Proje analizi tamamlandı!');
    } catch (err) {
        console.error(err);
        showToast('Analiz sırasında hata oluştu.', true);
    } finally {
        elements.btnRunAnalyser.disabled = false;
        elements.btnRunAnalyser.innerHTML = `<i data-lucide="search-code"></i><span>Mevcut Projeyi Analiz Et</span>`;
        if (window.lucide) window.lucide.createIcons();
    }
}

function copyAnalyserReport() {
    const text = elements.analyserSolutionCode.textContent;
    if (text) {
        copyTextToClipboard(text);
        showToast('Rapor kopyalandı!');
    }
}

function showDecisionImpactAnalysis(id, title) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(10,11,16,0.85)';
    modal.style.backdropFilter = 'blur(10px)';
    modal.style.zIndex = '9999';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    
    let details = '';
    if (id === 'DEC-001') {
        details = `
            <div style="background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-md); width:90%; max-width:500px; padding:2rem; box-shadow:0 20px 40px rgba(0,0,0,0.5);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                    <h3 style="color:var(--accent); margin:0; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="shield-alert"></i> <span>Değişiklik Etki Analizi</span></h3>
                    <button class="btn btn-secondary btn-icon-only" id="close-impact-modal" style="border:none;background:none;color:white;cursor:pointer;"><i data-lucide="x"></i></button>
                </div>
                <div style="font-size:0.85rem; color:var(--text-muted); line-height:1.6; display:flex; flex-direction:column; gap:1rem;">
                    <p><strong>Değişiklik Konusu:</strong> Katmanlı Mimari Yapısı (${escapeHTML(id)} - ${escapeHTML(title)})</p>
                    <p><strong style="color:var(--danger);">Etki Seviyesi:</strong> YÜKSEK (Architecture Core Change)</p>
                    <div>
                        <strong>Etkilenen Belgeler:</strong>
                        <ul style="padding-left:1.2rem; margin-top:0.3rem;">
                            <li>PROJECT_BRIEF.md</li>
                            <li>REQUIREMENTS.md</li>
                            <li>ARCHITECTURE.md</li>
                            <li>TECH_STACK.md</li>
                        </ul>
                    </div>
                    <div>
                        <strong>Etkilenen Kararlar:</strong>
                        <ul style="padding-left:1.2rem; margin-top:0.3rem;">
                            <li>DEC-002 (Local-First Depolama)</li>
                        </ul>
                    </div>
                    <p><strong>Görev Etkisi:</strong> 4 görev güncellenmeli, 2 yeni görev oluşturulmalı, 1 eski görev iptal ediliyor.</p>
                </div>
            </div>
        `;
    } else {
        details = `
            <div style="background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-md); width:90%; max-width:500px; padding:2rem; box-shadow:0 20px 40px rgba(0,0,0,0.5);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                    <h3 style="color:var(--secondary); margin:0; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="shield-alert"></i> <span>Değişiklik Etki Analizi</span></h3>
                    <button class="btn btn-secondary btn-icon-only" id="close-impact-modal" style="border:none;background:none;color:white;cursor:pointer;"><i data-lucide="x"></i></button>
                </div>
                <div style="font-size:0.85rem; color:var(--text-muted); line-height:1.6; display:flex; flex-direction:column; gap:1rem;">
                    <p><strong>Değişiklik Konusu:</strong> Local-First Veri Depolama (${escapeHTML(id)} - ${escapeHTML(title)})</p>
                    <p><strong style="color:var(--warning);">Etki Seviyesi:</strong> ORTA (Data Storage Layer)</p>
                    <div>
                        <strong>Etkilenen Belgeler:</strong>
                        <ul style="padding-left:1.2rem; margin-top:0.3rem;">
                            <li>ARCHITECTURE.md</li>
                            <li>TECH_STACK.md</li>
                        </ul>
                    </div>
                    <p><strong>Görev Etkisi:</strong> 2 görev güncellenmeli, 1 yeni veri tabanı migrasyon görevi eklenmeli.</p>
                </div>
            </div>
        `;
    }
    
    modal.innerHTML = details;
    document.body.appendChild(modal);
    
    if (window.lucide) window.lucide.createIcons();
    
    modal.querySelector('#close-impact-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
}
