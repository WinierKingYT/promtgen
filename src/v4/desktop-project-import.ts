import { invoke, isTauri } from '@tauri-apps/api/core';
import type { ProjectInventoryReport } from './project-analyzer.js';

export function isDesktopProjectImportAvailable(): boolean {
    return isTauri();
}

export async function selectDesktopProjectFolder(): Promise<ProjectInventoryReport | null> {
    if (!isTauri()) return null;
    return invoke('select_and_inventory_project_folder');
}
