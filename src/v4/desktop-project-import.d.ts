import type { ProjectInventoryReport } from './project-analyzer.js';

export function isDesktopProjectImportAvailable(): boolean;
export function selectDesktopProjectFolder(): Promise<ProjectInventoryReport | null>;
