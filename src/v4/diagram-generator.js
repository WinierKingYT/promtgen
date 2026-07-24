export function generateArchitectureDiagram(project) {
    const rawIdea = String(project.identity?.originalIdea || 'Proje').trim();
    const text = rawIdea.toLowerCase();
    
    const isGame = /oyun|s&box|unity|godot|unreal|engine|at|mount|fizik|arcade|yaratık|entity/.test(text);
    const isWebSaaS = /web|saas|e-ticaret|site|dashboard|portal|react|next|api|backend|veritabanı/.test(text);
    const isMobile = /mobil|mobile|ios|android|flutter|react native|app/.test(text);
    const isAi = /yapay zeka|ai|agent|llm|prompt|model|gpt|bot|vektör|rag/.test(text);

    const decisions = project.decisions || [];
    const decisionTitles = decisions.slice(0, 3).map((d, i) => `Dec${i+1}["${d.title.replace(/"/g, "'").slice(0, 30)}"]`);

    let diagram = 'graph TD\n';
    diagram += '    subgraph Client["İstemci & Arayüz Katmanı"]\n';
    diagram += `        UI["${rawIdea.replace(/"/g, "'").slice(0, 25)} Arayüzü"]\n`;
    diagram += '        Controller["İstemci Durum Yöneticisi"]\n';
    diagram += '    end\n\n';

    if (isAi) {
        diagram += '    subgraph AiPipeline["Yapay Zeka & RAG Katmanı"]\n';
        diagram += '        PromptEngine["Prompt & Bağlam Yöneticisi"]\n';
        diagram += '        VectorStore[("Vektör Veritabanı / RAG Hafızası")]\n';
        diagram += '    end\n\n';
        diagram += '    subgraph Providers["LLM & Model Sağlayıcılar"]\n';
        diagram += '        PrimaryLLM["Birincil AI Sağlayıcı"]\n';
        diagram += '        FallbackLLM["Yedek (Fallback) LLM Sağlayıcı"]\n';
        diagram += '    end\n\n';
        diagram += '    UI --> Controller\n';
        diagram += '    Controller --> PromptEngine\n';
        diagram += '    PromptEngine --> VectorStore\n';
        diagram += '    PromptEngine --> PrimaryLLM\n';
        diagram += '    PrimaryLLM -.->|Hata Halinde Fallback| FallbackLLM\n';
    } else if (isGame) {
        diagram += '    subgraph EngineRuntime["Oyun Motoru Runtime"]\n';
        diagram += '        Pawn["Oyuncu & Varlık Kontrolörü"]\n';
        diagram += '        Physics["Fizik & Animasyon Motoru"]\n';
        diagram += '    end\n\n';
        diagram += '    subgraph Network["Ağ & Sunucu Katmanı"]\n';
        diagram += '        Server["Sunucu Yetki Katmanı (Server-Authority)"]\n';
        diagram += '        Prediction["Ağ Tahmin Tamponu (Prediction)"]\n';
        diagram += '    end\n\n';
        diagram += '    UI --> Controller\n';
        diagram += '    Controller --> Prediction\n';
        diagram += '    Prediction --> Pawn\n';
        diagram += '    Pawn --> Physics\n';
        diagram += '    Prediction <-->|Ağ Senkronizasyonu| Server\n';
    } else if (isWebSaaS) {
        diagram += '    subgraph BackendServices["Web & API Servisleri"]\n';
        diagram += '        APIGateway["API Gateway & Yetki Katmanı"]\n';
        diagram += '        AppService["İş Mantığı Servisleri"]\n';
        diagram += '    end\n\n';
        diagram += '    subgraph Storage["Veri Depolama Katmanı"]\n';
        diagram += '        DB[("İlişkisel Veritabanı / SQL")]\n';
        diagram += '    end\n\n';
        diagram += '    UI --> Controller\n';
        diagram += '    Controller --> APIGateway\n';
        diagram += '    APIGateway --> AppService\n';
        diagram += '    AppService --> DB\n';
    } else if (isMobile) {
        diagram += '    subgraph MobileRuntime["Mobil Cihaz Katmanı"]\n';
        diagram += '        LocalDB[("Cihaz İçi SQLite Veritabanı")]\n';
        diagram += '        SyncEngine["Arka Plan Senkronizasyon Motoru"]\n';
        diagram += '    end\n\n';
        diagram += '    subgraph CloudAPI["Bulut Servisleri"]\n';
        diagram += '        CloudSync["Uzak Senkronizasyon API"]\n';
        diagram += '    end\n\n';
        diagram += '    UI --> Controller\n';
        diagram += '    Controller --> LocalDB\n';
        diagram += '    LocalDB --> SyncEngine\n';
        diagram += '    SyncEngine <-->|Local-First Sync| CloudSync\n';
    } else {
        diagram += '    subgraph Application["Çekirdek Sistem Servisleri"]\n';
        diagram += '        AppService["Uygulama Mantık Motoru"]\n';
        diagram += '        StateEngine["Yerel Durum Deposu"]\n';
        diagram += '    end\n\n';
        diagram += '    subgraph Storage["Depolama"]\n';
        diagram += '        DB[("Yerel Dosya / SQL Deposu")]\n';
        diagram += '    end\n\n';
        diagram += '    UI --> Controller\n';
        diagram += '    Controller --> AppService\n';
        diagram += '    AppService --> StateEngine\n';
        diagram += '    StateEngine --> DB\n';
    }

    if (decisionTitles.length) {
        diagram += '\n    subgraph DecisivionsNode["Kesinleşen Mimari Kararlar"]\n';
        decisionTitles.forEach(dt => { diagram += `        ${dt}\n`; });
        diagram += '    end\n';
        diagram += '    Controller -.-> DecisivionsNode\n';
    }

    diagram += '\n    classDef primary fill:#7c3aed,stroke:#a78bfa,color:#fff,stroke-width:2px;\n';
    diagram += '    classDef storage fill:#065f46,stroke:#10b981,color:#fff,stroke-width:2px;\n';
    diagram += '    class UI,Controller primary;\n';

    return diagram;
}

export function generateDataFlowDiagram(project) {
    let diagram = 'sequenceDiagram\n';
    diagram += '    autonumber\n';
    diagram += '    actor User as Kullanıcı / Oyuncu\n';
    diagram += '    participant System as Uygulama Sistemi\n';
    diagram += '    participant Store as Yaşayan Plan Deposu\n';

    diagram += '    User->>System: Girdi İsteği / Eylem (Action)\n';
    diagram += '    System->>System: Kısıt & Güvenlik Doğrulaması\n';
    diagram += '    System->>Store: Revizyon Artırımı & Durum Güncellemesi\n';
    diagram += '    Store-->>System: Durum Güncellemesi Onayı (Ack)\n';
    diagram += '    System-->>User: Yenilenmiş Arayüz / Geri Bildirim\n';

    return diagram;
}

export function generateTaskDependencyDiagram(project) {
    const tasks = project.tasks || [];
    if (!tasks.length) return 'graph LR\n    Empty["Henüz derlenmiş görev yok"]\n';

    let diagram = 'graph LR\n';
    tasks.forEach(task => {
        const safeTitle = (task.title || task.id).replace(/"/g, "'").slice(0, 25);
        diagram += `    ${task.id.replace(/[^a-zA-Z0-9]/g, '_')}["${safeTitle}"]\n`;
    });

    tasks.forEach(task => {
        const taskId = task.id.replace(/[^a-zA-Z0-9]/g, '_');
        (task.dependencies || []).forEach(depId => {
            const safeDepId = depId.replace(/[^a-zA-Z0-9]/g, '_');
            diagram += `    ${safeDepId} --> ${taskId}\n`;
        });
    });

    return diagram;
}
