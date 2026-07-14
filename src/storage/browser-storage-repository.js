export class BrowserStorageRepository {
    constructor(key = 'ai_arch_saved_projects') {
        this.storageKey = key;
    }

    getAllProjects() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error("Storage parse error, returning empty list", e);
            return [];
        }
    }

    saveProject(projectObj) {
        if (!projectObj || !projectObj.id) return false;
        try {
            const projects = this.getAllProjects();
            const idx = projects.findIndex(p => p.id === projectObj.id);
            if (idx > -1) {
                projects[idx] = projectObj;
            } else {
                projects.unshift(projectObj);
            }
            localStorage.setItem(this.storageKey, JSON.stringify(projects));
            return true;
        } catch (e) {
            console.error("Failed to save project to storage", e);
            return false;
        }
    }

    deleteProject(id) {
        try {
            let projects = this.getAllProjects();
            projects = projects.filter(p => p.id !== id);
            localStorage.setItem(this.storageKey, JSON.stringify(projects));
            return true;
        } catch (e) {
            console.error("Failed to delete project from storage", e);
            return false;
        }
    }
}
