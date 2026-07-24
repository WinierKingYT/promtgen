export function getDomainAgentCommittee(project) {
    const text = `${project.identity?.originalIdea || ''} ${project.identity?.name || ''}`.toLowerCase();
    const isGame = /oyun|s&box|unity|godot|unreal|engine|fizik|arcade|yaratık|entity/.test(text);
    const isWebSaaS = /web|saas|e-ticaret|site|dashboard|portal|react|next|api|backend|veritabanı/.test(text);
    const isMobile = /mobil|mobile|ios|android|flutter|react native|app/.test(text);
    const isAi = /yapay zeka|ai|agent|llm|prompt|model|gpt|bot/.test(text);

    if (isGame) {
        return [
            {
                id: 'agent-gameplay',
                name: 'Oyun Mekaniği & UX Ajanı',
                role: 'Gameplay Architect',
                icon: '🎮',
                color: '#8b5cf6',
                focus: 'Oynanış döngüsü, oyuncu kontrolleri ve girdi gecikmesi (input lag)'
            },
            {
                id: 'agent-netcode',
                name: 'Ağ & Senkronizasyon Ajanı',
                role: 'Netcode & Multiplayer Specialist',
                icon: '🌐',
                color: '#3b82f6',
                focus: 'Server Authority, Client Prediction, Lag Compensation ve Tick Rate'
            },
            {
                id: 'agent-physics',
                name: 'Fizik & Motor Performansı Ajanı',
                role: 'Physics & Engine Engineer',
                icon: '⚡',
                color: '#f59e0b',
                focus: 'FPS kararlılığı, bellek yönetimi, Rigidbody karmaşıklığı ve Draw Call'
            },
            {
                id: 'agent-modding',
                name: 'Varlık & Eklenti Mimarı',
                role: 'Asset & Modding Architect',
                icon: '🛠️',
                color: '#10b981',
                focus: 'Mod desteği, prefab yönetimi, paketleme ve topluluk içeriği altyapısı'
            }
        ];
    }

    if (isWebSaaS) {
        return [
            {
                id: 'agent-frontend',
                name: 'Ön Yüz & Arayüz Mimarı',
                role: 'Frontend & UI Specialist',
                icon: '🎨',
                color: '#8b5cf6',
                focus: 'React/Next.js render optimizasyonu, UX akışı ve duyarlı (responsive) tasarım'
            },
            {
                id: 'agent-backend',
                name: 'Arka Yüz & Veritabanı Mimarı',
                role: 'Backend & Data Architect',
                icon: '🗄️',
                color: '#3b82f6',
                focus: 'REST/GraphQL API mimarisi, PostgreSQL şeması ve sorgu performansı'
            },
            {
                id: 'agent-security',
                name: 'Güvenlik & Yetki Uzmanı',
                role: 'Security & Auth Specialist',
                icon: '🛡️',
                color: '#ef4444',
                focus: 'JWT/Session güvenliği, RBAC yetkilendirme, CORS ve OWASP önlemleri'
            },
            {
                id: 'agent-devops',
                name: 'DevOps & Bulut Altyapı Mimarı',
                role: 'DevOps & Infrastructure Engineer',
                icon: '🚀',
                color: '#10b981',
                focus: 'Docker konteynerizasyon, CI/CD otomasyonu, CDN ve ölçeklenme'
            }
        ];
    }

    if (isMobile) {
        return [
            {
                id: 'agent-mobile-ux',
                name: 'Mobil UX & Arayüz Mimarı',
                role: 'Mobile UI/UX Specialist',
                icon: '📱',
                color: '#8b5cf6',
                focus: 'Dokunmatik jestler, ekran uyumu ve akıcı animasyonlar'
            },
            {
                id: 'agent-offline',
                name: 'Çevrimdışı Veri & Depolama Ajanı',
                role: 'Offline-First Architect',
                icon: '💾',
                color: '#3b82f6',
                focus: 'SQLite / MMKV yerel veritabanı ve arka plan senkronizasyonu'
            },
            {
                id: 'agent-device',
                name: 'Cihaz Donanım Entegrasyon Ajanı',
                role: 'Device Hardware Specialist',
                icon: '📷',
                color: '#f59e0b',
                focus: 'Kamera, konum, push bildirimler ve pil koruma optimizasyonu'
            },
            {
                id: 'agent-store',
                name: 'Yayın & Güvenlik Uzmanı',
                role: 'App Store & Security Specialist',
                icon: '🛡️',
                color: '#10b981',
                focus: 'App Store / Play Store uyumluluğu ve biyo-doğrulama (FaceID)'
            }
        ];
    }

    if (isAi) {
        return [
            {
                id: 'agent-prompt',
                name: 'Prompt & Ajan Akış Mimarı',
                role: 'Prompt & Agent Workflow Architect',
                icon: '🧠',
                color: '#8b5cf6',
                focus: 'Ajan rol tanımları, zincirleme (chaining) ve az örnekli (few-shot) istemler'
            },
            {
                id: 'agent-rag',
                name: 'Vektör & RAG Veri Mimarı',
                role: 'Vector DB & RAG Specialist',
                icon: '📚',
                color: '#3b82f6',
                focus: 'Embedding modelleri, Vector DB indeksleme ve semantik arama'
            },
            {
                id: 'agent-guardrail',
                name: 'Model Güvenlik & Gizlilik Uzmanı',
                role: 'AI Safety & Guardrail Specialist',
                icon: '🛡️',
                color: '#ef4444',
                focus: 'Hassas veri maskeleme, prompt injection koruması ve içerik filtresi'
            },
            {
                id: 'agent-llm-ops',
                name: 'LLMOps & Fallback Altyapı Ajanı',
                role: 'LLMOps & Fallback Engineer',
                icon: '⚡',
                color: '#10b981',
                focus: 'Yerel Ollama / Cloud LLM fallback, gecikme (latency) ve maliyet optimizasyonu'
            }
        ];
    }

    // Check if custom 5th agent slot exists
    const baseCommittee = (() => {
        if (isGame) return [
            { id: 'agent-gameplay', name: 'Oyun Mekaniği & UX Ajanı', role: 'Gameplay Architect', icon: '🎮', color: '#8b5cf6', focus: 'Oynanış döngüsü, oyuncu kontrolleri ve girdi gecikmesi' },
            { id: 'agent-netcode', name: 'Ağ & Senkronizasyon Ajanı', role: 'Netcode & Multiplayer Specialist', icon: '🌐', color: '#3b82f6', focus: 'Server Authority, Client Prediction ve Tick Rate' },
            { id: 'agent-physics', name: 'Fizik & Motor Performansı Ajanı', role: 'Physics & Engine Engineer', icon: '⚡', color: '#f59e0b', focus: 'FPS kararlılığı, bellek yönetimi ve Rigidbody karmaşıklığı' },
            { id: 'agent-modding', name: 'Varlık & Eklenti Mimarı', role: 'Asset & Modding Architect', icon: '🛠️', color: '#10b981', focus: 'Mod desteği, prefab yönetimi ve topluluk içeriği altyapısı' }
        ];
        if (isWebSaaS) return [
            { id: 'agent-frontend', name: 'Ön Yüz & Arayüz Mimarı', role: 'Frontend & UI Specialist', icon: '🎨', color: '#8b5cf6', focus: 'React/Next.js render optimizasyonu ve duyarlı tasarım' },
            { id: 'agent-backend', name: 'Arka Yüz & Veritabanı Mimarı', role: 'Backend & Data Architect', icon: '🗄️', color: '#3b82f6', focus: 'REST/GraphQL API mimarisi ve PostgreSQL şeması' },
            { id: 'agent-security', name: 'Güvenlik & Yetki Uzmanı', role: 'Security & Auth Specialist', icon: '🛡️', color: '#ef4444', focus: 'JWT/Session güvenliği ve RBAC yetkilendirme' },
            { id: 'agent-devops', name: 'DevOps & Bulut Altyapı Mimarı', role: 'DevOps & Infrastructure Engineer', icon: '🚀', color: '#10b981', focus: 'Docker konteynerizasyon ve CI/CD otomasyonu' }
        ];
        if (isMobile) return [
            { id: 'agent-mobile-ux', name: 'Mobil UX & Arayüz Mimarı', role: 'Mobile UI/UX Specialist', icon: '📱', color: '#8b5cf6', focus: 'Dokunmatik jestler ve ekran uyumu' },
            { id: 'agent-offline', name: 'Çevrimdışı Veri & Depolama Ajanı', role: 'Offline-First Architect', icon: '💾', color: '#3b82f6', focus: 'SQLite / MMKV yerel veritabanı ve senkronizasyon' },
            { id: 'agent-device', name: 'Cihaz Donanım Entegrasyon Ajanı', role: 'Device Hardware Specialist', icon: '📷', color: '#f59e0b', focus: 'Kamera, konum ve push bildirimler' },
            { id: 'agent-store', name: 'Yayın & Güvenlik Uzmanı', role: 'App Store & Security Specialist', icon: '🛡️', color: '#10b981', focus: 'App Store uyumluluğu ve FaceID doğrulaması' }
        ];
        if (isAi) return [
            { id: 'agent-prompt', name: 'Prompt & Ajan Akış Mimarı', role: 'Prompt & Agent Workflow Architect', icon: '🧠', color: '#8b5cf6', focus: 'Ajan rol tanımları ve zincirleme istemler' },
            { id: 'agent-rag', name: 'Vektör & RAG Veri Mimarı', role: 'Vector DB & RAG Specialist', icon: '📚', color: '#3b82f6', focus: 'Embedding modelleri ve Vector DB indeksleme' },
            { id: 'agent-guardrail', name: 'Model Güvenlik & Gizlilik Uzmanı', role: 'AI Safety & Guardrail Specialist', icon: '🛡️', color: '#ef4444', focus: 'Hassas veri maskeleme ve prompt injection koruması' },
            { id: 'agent-llm-ops', name: 'LLMOps & Fallback Altyapı Ajanı', role: 'LLMOps & Fallback Engineer', icon: '⚡', color: '#10b981', focus: 'Yerel Ollama / Cloud LLM fallback ve gecikme optimizasyonu' }
        ];
        return [
            { id: 'agent-ux', name: 'Kullanıcı Deneyimi Mimarı', role: 'UX Architect', icon: '🎨', color: '#8b5cf6', focus: 'Kullanım kolaylığı ve arayüz akışı' },
            { id: 'agent-tech', name: 'Teknik Sistem Mimarı', role: 'System Architect', icon: '⚙️', color: '#3b82f6', focus: 'Teknoloji seçimi ve modüler mimari' },
            { id: 'agent-sec', name: 'Güvenlik & Risk Mimarı', role: 'Security & Risk Architect', icon: '🛡️', color: '#ef4444', focus: 'Veri gizliliği ve hata toleransı' },
            { id: 'agent-ops', name: 'Yayın & Dağıtım Uzmanı', role: 'DevOps & Delivery Specialist', icon: '🚀', color: '#10b981', focus: 'Canlıya alma hazırlığı ve efor tahmini' }
        ];
    })();

    if (project.customAgentSlot) {
        return [...baseCommittee, project.customAgentSlot];
    }
    return baseCommittee;
}

export function runCommitteeEvaluation(project) {
    const committee = getDomainAgentCommittee(project);
    const idea = String(project.identity?.originalIdea || 'Proje').trim();

    return committee.map(agent => {
        let recommendation = '';
        let decisionProposal = '';

        if (agent.id.includes('gameplay') || agent.id.includes('ux') || agent.id.includes('frontend')) {
            recommendation = `"${idea}" projesinde kullanıcı / oyuncu etkileşim döngüsü sade tutulmalı. İlk aşamada gereksiz karmaşık menüler yerine temel eylemlere odaklanılmalı.`;
            decisionProposal = 'Erken aşamada sezgisel ve hızlı prototip UX akışı kabul edilsin.';
        } else if (agent.id.includes('netcode') || agent.id.includes('backend') || agent.id.includes('offline') || agent.id.includes('rag')) {
            recommendation = `Veri katmanında güvenilir ve performanslı bir altyapı seçilmeli. Veri tutarlılığı ve senkronizasyon kuralı baştan netleştirilmeli.`;
            decisionProposal = 'Veri katmanında modüler ve genişletilebilir mimari kararı kabul edilsin.';
        } else if (agent.id.includes('security') || agent.id.includes('guardrail') || agent.id.includes('sec')) {
            recommendation = `Hassas verilerin (API anahtarları, kullanıcı bilgileri) yerel olarak korunması ve OWASP / güvenlik standartlarına uyum sağlanmalı.`;
            decisionProposal = 'Sistemde sıfır güven (Zero-Trust) ve hassas veri maskeleme prensibi kabul edilsin.';
        } else {
            recommendation = `Dağıtım ve yayın sürecinde otomatik CI/CD ve versiyon kontrolü kurularak test edilmemiş kodların canlıya geçmesi engellenmeli.`;
            decisionProposal = 'Otomatik kalite kapısı (Quality Gate) ve CI/CD pipeline kararı kabul edilsin.';
        }

        return {
            agent,
            recommendation,
            decisionProposal
        };
    });
}

export function runCommitteeVoting(project) {
    const committee = getDomainAgentCommittee(project);
    const acceptedDecisions = (project.decisions || []).filter(d => d.status === 'accepted');

    const votes = committee.map(agent => {
        // Vote logic based on accepted decisions count & readiness
        let vote = 'approved';
        let note = 'Mevcut kararları kendi uzmanlık alanım açısından onaylıyorum.';

        if (acceptedDecisions.length < 2) {
            vote = 'conditional';
            note = 'Henüz yeterli sayıda netleşmiş karar yok; en az 2 kabul edilmiş mimari karar gerekli.';
        } else if (agent.id.includes('security') && !acceptedDecisions.some(d => /auth|güvenlik|gizlilik|jwt|session|zero-trust/i.test(`${d.title} ${d.decision}`))) {
            vote = 'rejected';
            note = 'Güvenlik ve yetkilendirme kararı açıkça belirtilmemiş.';
        }

        return {
            agent,
            vote, // 'approved' | 'conditional' | 'rejected'
            note
        };
    });

    const approvedCount = votes.filter(v => v.vote === 'approved').length;
    const conditionalCount = votes.filter(v => v.vote === 'conditional').length;
    const score = Math.round(((approvedCount * 1.0 + conditionalCount * 0.5) / committee.length) * 100);

    return {
        score,
        votes,
        summary: score >= 80 ? 'Konsey yüksek derecede uyum sağladı (%' + score + ').' : score >= 50 ? 'Konsey şartlı onay verdi (%' + score + '). Ek kararlar bekleniyor.' : 'Konseyde kritik çekinceler var (%' + score + ').'
    };
}
