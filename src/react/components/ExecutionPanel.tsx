import { useEffect, useMemo, useState } from 'react';
import { Bot, Check, CircleAlert, Code2, Download, FolderGit2, LoaderCircle, Play, ShieldCheck, Trash2 } from 'lucide-react';
import { beginExecutionSession, buildExecutionPrompt, getNextExecutionRole, proposeExecution, recordExecutionResult, simulateExecutionRun } from '../../v4/execution-orchestrator.js';
import { cleanupExecutionWorktree, getExecutionCapabilities, getExecutionPatch, nativeExecutionAvailable, prepareExecutionWorktree, runCodexAgentStep, selectExecutionRepository } from '../../v4/desktop-execution.js';
import { downloadBlob } from '../../v4/exporter.js';

export function ExecutionPanel({ project, onCommit }: { project: any; onCommit: (project: any, message: string) => void }) {
  const desktop = nativeExecutionAvailable();
  const proposal = useMemo(() => proposeExecution(project, desktop ? 'codex' : 'generic'), [project, desktop]);
  const [capabilities, setCapabilities] = useState<any>(null);
  const [repository, setRepository] = useState<any>(null);
  const [nativeSession, setNativeSession] = useState<any>(null);
  const [logicalSessionId, setLogicalSessionId] = useState('');
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [patch, setPatch] = useState<any>(null);
  const logicalSession = project.executionSessions.find((item: any) => item.id === logicalSessionId) || project.executionSessions.at(-1);
  const nextRole = logicalSession ? getNextExecutionRole(logicalSession).role : null;

  useEffect(() => {
    if (!desktop) return;
    const refresh = () => getExecutionCapabilities().then(setCapabilities).catch((value: unknown) => setError(String(value)));
    refresh();
    window.addEventListener('promtgen:execution-settings-changed', refresh);
    return () => window.removeEventListener('promtgen:execution-settings-changed', refresh);
  }, [desktop]);
  const selectRepository = async () => { setBusy(true); setError(''); try { const selected = await selectExecutionRepository(); if (selected) setRepository(selected); } catch (value) { setError(String(value)); } finally { setBusy(false); } };
  const prepare = async () => {
    setBusy(true); setError('');
    try {
      const worktree = await prepareExecutionWorktree(repository.repositoryToken, project.id);
      const started = beginExecutionSession(project, proposal, { approved: true, force, worktreeLabel: worktree.worktreeLabel });
      if (!started.success || !started.session) throw new Error(started.reason);
      setNativeSession(worktree); setLogicalSessionId(started.session.id); onCommit(started.project, 'İzole Codex execution session hazırlandı.');
    } catch (value) { setError(value instanceof Error ? value.message : String(value)); }
    finally { setBusy(false); }
  };
  const startGeneric = () => {
    const started = beginExecutionSession(project, proposal, { approved: true, force });
    if (!started.success || !started.session) { setError(started.reason); return; }
    setLogicalSessionId(started.session.id); onCommit(started.project, 'Generic ajan paketi haricî kullanım için kaydedildi.');
  };
  const runStep = async () => {
    if (!nativeSession || !logicalSession || !nextRole) return;
    setBusy(true); setError('');
    try {
      const prompt = buildExecutionPrompt(project, logicalSession.id, nextRole);
      const result: any = await runCodexAgentStep(nativeSession.sessionToken, nextRole, prompt);
      const recorded = recordExecutionResult(project, logicalSession.id, result);
      if (!recorded.success) throw new Error(recorded.reason);
      onCommit(recorded.project, `${nextRole} ajan adımı ${result.success ? 'tamamlandı' : 'başarısız oldu'}.`);
    } catch (value) { setError(value instanceof Error ? value.message : String(value)); }
    finally { setBusy(false); }
  };
  const inspectPatch = async () => { if (!nativeSession) return; setBusy(true); try { setPatch(await getExecutionPatch(nativeSession.sessionToken)); } catch (value) { setError(String(value)); } finally { setBusy(false); } };
  const removeWorktree = async () => { if (!nativeSession) return; setBusy(true); try { await cleanupExecutionWorktree(nativeSession.sessionToken); setNativeSession(null); setRepository(null); setPatch(null); } catch (value) { setError(String(value)); } finally { setBusy(false); } };

  return <details className="execution-panel">
    <summary><Bot size={16}/><span>Ajan execution<small>{desktop ? 'Codex · izole worktree' : 'Generic export-only'} · {project.executionSessions.length} session</small></span></summary>
    <div className="execution-body">
      <p>{desktop ? 'Her rol ayrı native onay ister. Implementer workspace-write, diğer roller read-only sandbox kullanır.' : 'PWA keyfî komut çalıştırmaz; ajan runbook ve promptları export paketinden kullanılır.'}</p>
      {proposal.blockers.length > 0 && <div className="execution-blockers"><CircleAlert size={14}/><span>{proposal.blockers.map((item: string) => <small key={item}>{item}</small>)}</span></div>}
      {proposal.blockers.length > 0 && <label className="force-execution"><input type="checkbox" checked={force} onChange={event => setForce(event.target.checked)}/><span>Blocker’ları gördüm; bilinçli olarak session hazırlamaya devam et.</span></label>}
      {desktop ? <>
        <div className="runtime-status"><span className={capabilities?.gitAvailable ? 'ok' : 'bad'}>{capabilities?.gitAvailable ? <Check size={12}/> : <CircleAlert size={12}/>} Git {capabilities?.gitVersion || 'bulunamadı'}</span><span className={capabilities?.codexAvailable ? 'ok' : 'bad'}>{capabilities?.codexAvailable ? <Check size={12}/> : <CircleAlert size={12}/>} Codex {capabilities?.codexVersion || capabilities?.codexError || 'bulunamadı'}{capabilities?.codexSource === 'custom' ? ' · seçili' : ''}</span></div>
        {!repository && <button type="button" disabled={busy || !capabilities?.gitAvailable} onClick={selectRepository}><FolderGit2 size={15}/> Git repository seç</button>}
        {repository && !nativeSession && <div className="repository-card"><FolderGit2 size={16}/><span><b>{repository.displayName}</b><small>{repository.branch}{repository.dirty ? ' · ana worktree kirli' : ' · temiz'}</small></span><button type="button" disabled={busy || !capabilities?.codexAvailable || (proposal.blockers.length > 0 && !force)} onClick={prepare}>{busy ? <LoaderCircle className="spin" size={14}/> : <ShieldCheck size={14}/>} Worktree oluştur</button></div>}
        {nativeSession && logicalSession && <><div className="execution-steps">{logicalSession.steps.map((step: any) => <div key={step.role} className={`${step.status} risk-${step.risk}`}><span>{step.status === 'completed' ? <Check size={13}/> : <Code2 size={13}/>}<b>{step.role}</b></span><small>{step.risk} · {step.status}</small></div>)}</div>{nextRole && <button type="button" className="primary" disabled={busy} onClick={runStep}>{busy ? <LoaderCircle className="spin" size={14}/> : <Play size={14}/>} {nextRole} adımını onayla ve çalıştır</button>}<div className="execution-actions"><button type="button" disabled={busy} onClick={inspectPatch}><Code2 size={14}/> Değişiklik özeti</button><button type="button" disabled={busy} onClick={removeWorktree}><Trash2 size={14}/> Worktree kaldır</button></div></>}
        {patch && <div className="patch-summary"><pre>{patch.status || 'Çalışma ağacı temiz.'}\n{patch.stat}</pre>{patch.patch && <button type="button" onClick={() => downloadBlob(new Blob([patch.patch], { type: 'text/x-diff' }), `${project.identity.name}.patch`)}><Download size={14}/> Patch indir{patch.truncated ? ' (kesilmiş)' : ''}</button>}</div>}
      </> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button type="button" disabled={proposal.blockers.length > 0 && !force} onClick={startGeneric}><Download size={15}/> Generic execution kaydı oluştur</button>
          <button
            type="button"
            style={{ background: 'rgba(139, 92, 246, 0.2)', border: '1px solid rgba(139, 92, 246, 0.4)', color: '#a78bfa', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
            onClick={() => {
              const start = beginExecutionSession(project, proposal, { approved: true, force: true });
              if (start.success && start.session) {
                const sim = simulateExecutionRun(start.project, start.session.id);
                if (sim.success) onCommit(sim.project, 'Ajan execution adımları başarıyla simüle edildi.');
              }
            }}
          >
            ⚡ Ajan Execution Adımlarını Simüle Et (Planner → Implementer → Reviewer → Verifier)
          </button>
        </div>
      )}
      {error && <p className="execution-error" role="alert"><CircleAlert size={14}/>{error}</p>}
    </div>
  </details>;
}
