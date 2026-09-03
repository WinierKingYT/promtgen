import { invoke, isTauri } from '@tauri-apps/api/core';

export function nativeExecutionAvailable() { return isTauri(); }
export async function getExecutionCapabilities() { return isTauri() ? invoke('execution_capabilities') : { gitAvailable: false, gitVersion: '', codexAvailable: false, codexVersion: '', codexSource: 'missing', codexPath: '', codexError: '', customCodexConfigured: false }; }
export async function selectCodexCli() { return invoke('select_codex_cli'); }
export async function clearCodexCli() { return invoke('clear_codex_cli'); }
export async function selectExecutionRepository() { return invoke('select_execution_repository'); }
// EP-09: Bu iki çağrı Agent Devri akışına bağlanırken, tetikleyen bileşen
// ÖNCE `stageGate(project, 'handoff').open === true` kontrolünü yapmalı
// (bkz. src/v4/application/project-stages.ts). Kapı, plan finalize edilmeden
// kapalıdır; yarım plan bir coding agent'a devredilmez.
export async function prepareExecutionWorktree(repositoryToken, projectId) { return invoke('prepare_execution_worktree', { repositoryToken, projectId }); }
export async function runCodexAgentStep(sessionToken, role, prompt) { return invoke('run_codex_agent_step', { sessionToken, role, prompt }); }
export async function getExecutionPatch(sessionToken) { return invoke('execution_patch', { sessionToken }); }
export async function cleanupExecutionWorktree(sessionToken) { return invoke('cleanup_execution_worktree', { sessionToken }); }
