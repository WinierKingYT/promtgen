export class BrowserStorageRepository {
    constructor(key = 'ai_arch_saved_projects') {
        this.storageKey = key;
        this.indexKey = 'ai_arch_saved_projects_index';
    }

    getAllProjects() {
        try {
            // Check if index exists
            const rawIndex = localStorage.getItem(this.indexKey);
            if (rawIndex) {
                const index = JSON.parse(rawIndex);
                if (Array.isArray(index)) {
                    // Load each project from its individual key
                    const projects = [];
                    for (const meta of index) {
                        const projectRaw = localStorage.getItem(`ai_arch_project_${meta.id}`);
                        if (projectRaw) {
                            try {
                                projects.push(JSON.parse(projectRaw));
                            } catch (e) {
                                console.error(`Error parsing project ${meta.id}`, e);
                            }
                        }
                    }
                    return projects;
                }
            }

            // Fallback: migrate old projects array if index doesn't exist
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            const projects = Array.isArray(parsed) ? parsed : [];
            
            // Save them individually and create index
            if (projects.length > 0) {
                const index = [];
                for (const p of projects) {
                    localStorage.setItem(`ai_arch_project_${p.id}`, JSON.stringify(p));
                    index.push({ id: p.id, name: p.name || p.draftDescription || 'Yeni Proje', updatedAt: new Date().toISOString() });
                }
                localStorage.setItem(this.indexKey, JSON.stringify(index));
                // Clear old storage key to free space
                localStorage.removeItem(this.storageKey);
            }
            return projects;
        } catch (e) {
            console.error("Storage parse error, returning empty list", e);
            return [];
        }
    }

    saveProject(projectObj) {
        if (!projectObj || !projectObj.id) return false;
        try {
            // Write project to its separate key
            const projectStr = JSON.stringify(projectObj);
            
            // Perform basic checksum / verification before writing
            if (!projectStr) throw new Error("Serialization error.");
            
            // Check quota
            try {
                localStorage.setItem(`ai_arch_project_${projectObj.id}`, projectStr);
            } catch (quotaError) {
                console.error("Storage Quota Exceeded!", quotaError);
                throw new Error("Tarayıcı hafıza kotası doldu! Lütfen gereksiz projeleri silin.");
            }

            // Update index
            let index = [];
            const rawIndex = localStorage.getItem(this.indexKey);
            if (rawIndex) {
                try {
                    index = JSON.parse(rawIndex);
                } catch (e) {
                    index = [];
                }
            }
            
            const name = projectObj.currentProjectState?.identity?.name || projectObj.draftDescription || 'Yeni Proje';
            const metaIdx = index.findIndex(m => m.id === projectObj.id);
            const meta = { id: projectObj.id, name, updatedAt: new Date().toISOString() };
            if (metaIdx > -1) {
                index[metaIdx] = meta;
            } else {
                index.unshift(meta);
            }
            localStorage.setItem(this.indexKey, JSON.stringify(index));
            return true;
        } catch (e) {
            console.error("Failed to save project to storage", e);
            alert("Proje kaydedilemedi: " + e.message); // Inform the user!
            return false;
        }
    }

    deleteProject(id) {
        try {
            // Remove project key
            localStorage.removeItem(`ai_arch_project_${id}`);
            
            // Update index
            const rawIndex = localStorage.getItem(this.indexKey);
            if (rawIndex) {
                try {
                    let index = JSON.parse(rawIndex);
                    index = index.filter(m => m.id !== id);
                    localStorage.setItem(this.indexKey, JSON.stringify(index));
                } catch (e) {
                    console.error("Index load error during delete", e);
                }
            }
            return true;
        } catch (e) {
            console.error("Failed to delete project from storage", e);
            return false;
        }
    }
}
