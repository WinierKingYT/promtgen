import { invoke, isTauri } from '@tauri-apps/api/core';

export function isDesktopProjectImportAvailable() {
    return isTauri();
}

export async function selectDesktopProjectFolder() {
    if (!isTauri()) return null;
    return invoke('select_and_inventory_project_folder');
}
