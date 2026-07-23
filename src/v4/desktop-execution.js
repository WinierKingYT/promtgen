import { invoke, isTauri } from '@tauri-apps/api/core';

export function nativeExecutionAvailable() { return isTauri(); }
export async function getExecutionCapabilities() { return isTauri() ? invoke('execution_capabilities') : { gitAvailable: false, gitVersion: '', codexAvailable: false, codexVersion: '' }; }
export async function selectExecutionRepository() { return invoke('select_execution_repository'); }
export async function prepareExecutionWorktree(repositoryToken, projectId) { return invoke('prepare_execution_worktree', { repositoryToken, projectId }); }
export async function runCodexAgentStep(sessionToken, role, prompt) { return invoke('run_codex_agent_step', { sessionToken, role, prompt }); }
export async function getExecutionPatch(sessionToken) { return invoke('execution_patch', { sessionToken }); }
export async function cleanupExecutionWorktree(sessionToken) { return invoke('cleanup_execution_worktree', { sessionToken }); }
