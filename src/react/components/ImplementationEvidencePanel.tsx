import { useMemo, useState } from 'react';
import { Check, CircleAlert, ClipboardCheck, X } from 'lucide-react';
import type {
  ImplementationEvidencePackage,
  ProjectDocumentV5
} from '../../v4/contracts.js';
import {
  createImplementationEvidenceReview,
  decideImplementationEvidence
} from '../../v4/application/implementation-evidence-service.js';

function lines(value: string) {
  return value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
}

function splitRecord(value: string) {
  return value.split('|').map(item => item.trim());
}

export function ImplementationEvidencePanel({
  project,
  onCommit
}: {
  project: ProjectDocumentV5;
  onCommit: (project: ProjectDocumentV5, message?: string, commandType?: string) => void | Promise<void>;
}) {
  const availableTasks = project.tasks.filter(task => task.status !== 'done');
  const [taskId, setTaskId] = useState(availableTasks[0]?.id || '');
  const [source, setSource] = useState<ImplementationEvidencePackage['source']>('manual');
  const [summary, setSummary] = useState('');
  const [changedFiles, setChangedFiles] = useState('');
  const [testRuns, setTestRuns] = useState('');
  const [acceptanceEvidence, setAcceptanceEvidence] = useState('');
  const [remainingIssues, setRemainingIssues] = useState('');
  const [rollbackNotes, setRollbackNotes] = useState('');
  const [reviewerNote, setReviewerNote] = useState('');
  const [review, setReview] = useState<ImplementationEvidencePackage | null>(null);
  const [notice, setNotice] = useState('');
  const task = useMemo(() => project.tasks.find(item => item.id === taskId), [project.tasks, taskId]);

  const createReview = () => {
    try {
      const nextReview = createImplementationEvidenceReview(project, {
        taskId,
        source,
        summary,
        changedFiles: lines(changedFiles).map(line => {
          const [path, changeType = 'modified', note = ''] = splitRecord(line);
          return {
            path,
            changeType: ['added', 'modified', 'deleted'].includes(changeType)
              ? changeType as 'added' | 'modified' | 'deleted'
              : 'modified',
            note
          };
        }),
        testRuns: lines(testRuns).map(line => {
          const [command, status = 'not_run', outputSummary = ''] = splitRecord(line);
          return {
            command,
            status: ['passed', 'failed', 'not_run'].includes(status)
              ? status as 'passed' | 'failed' | 'not_run'
              : 'not_run',
            outputSummary
          };
        }),
        acceptanceEvidence: lines(acceptanceEvidence).map(line => {
          const [criterion, status = 'unclear', evidence = ''] = splitRecord(line);
          return {
            criterion,
            status: ['met', 'not_met', 'unclear'].includes(status)
              ? status as 'met' | 'not_met' | 'unclear'
              : 'unclear',
            evidence
          };
        }),
        remainingIssues: lines(remainingIssues),
        rollbackNotes
      });
      setReview(nextReview);
      setNotice('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const decide = async (decision: 'accept' | 'reject') => {
    if (!review) return;
    const result = decideImplementationEvidence(project, review, decision, reviewerNote);
    if (!result.success) {
      setNotice(result.reason);
      return;
    }
    await onCommit(result.project, result.reason, decision === 'accept' ? 'AcceptImplementationEvidence' : 'RejectImplementationEvidence');
    setReview(null);
    setNotice('');
  };

  return (
    <details className="implementation-evidence-panel">
      <summary>
        <span><b>Görev teslim kanıtı</b><small>Dışarıda yapılan işi TaskContract’a göre incele</small></span>
        <strong>{project.implementationEvidencePackages.filter(item => item.status === 'accepted').length} onaylı</strong>
      </summary>
      <div className="implementation-evidence-body">
        <p className="alignment-boundary"><b>PromtGen kod yazmaz.</b> Codex, Cursor, Claude Code veya manuel çalışmadan gelen kanıtı inceler; sen açıkça onaylamadan görev tamamlanmaz.</p>
        {!availableTasks.length ? <p className="alignment-empty">Kanıt bekleyen açık görev bulunmuyor.</p> : <>
          <div className="evidence-grid">
            <label>Görev<select aria-label="Kanıt görevi" value={taskId} onChange={event => { setTaskId(event.target.value); setReview(null); }}>{availableTasks.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
            <label>Kaynak<select aria-label="Kanıt kaynağı" value={source} onChange={event => setSource(event.target.value as ImplementationEvidencePackage['source'])}><option value="manual">Manuel</option><option value="codex">Codex</option><option value="cursor">Cursor</option><option value="claude-code">Claude Code</option><option value="other">Diğer</option></select></label>
          </div>
          {task && <div className="evidence-contract"><b>Beklenen sözleşme</b><span>{task.contract.filePolicy.allowedPaths.join(', ') || 'Dosya kapsamı henüz yok'}</span><span>{task.contract.verification.commands.join(', ') || 'Doğrulama komutu keşfedilmeli'}</span></div>}
          <label>Uygulama özeti<textarea aria-label="Uygulama kanıtı özeti" rows={3} value={summary} onChange={event => setSummary(event.target.value)} placeholder="Dış araç veya geliştirici neyi tamamladı?"/></label>
          <label>Değişen dosyalar <small>Her satır: yol | added/modified/deleted | not</small><textarea aria-label="Değişen dosya kanıtları" rows={4} value={changedFiles} onChange={event => setChangedFiles(event.target.value)} placeholder="src/feature.ts | modified | doğrulama eklendi"/></label>
          <label>Test çalıştırmaları <small>Her satır: komut | passed/failed/not_run | çıktı özeti</small><textarea aria-label="Test çalıştırma kanıtları" rows={4} value={testRuns} onChange={event => setTestRuns(event.target.value)} placeholder="npm test | passed | 42 test geçti"/></label>
          <label>Kabul kriteri kanıtları <small>Her satır: kriter | met/not_met/unclear | kanıt</small><textarea aria-label="Kabul kriteri kanıtları" rows={4} value={acceptanceEvidence} onChange={event => setAcceptanceEvidence(event.target.value)} placeholder="Kullanıcı kaydı oluşturabilir | met | e2e testi geçti"/></label>
          <label>Açık sorunlar<textarea aria-label="Kalan uygulama sorunları" rows={2} value={remainingIssues} onChange={event => setRemainingIssues(event.target.value)} placeholder="Her satıra çözülmemiş bir konu; yoksa boş bırak"/></label>
          <label>Geri alma notu<textarea aria-label="Uygulama geri alma notu" rows={2} value={rollbackNotes} onChange={event => setRollbackNotes(event.target.value)} placeholder="Değişiklik nasıl güvenle geri alınır?"/></label>
          <button type="button" onClick={createReview}><ClipboardCheck size={15}/> Kanıtı incele</button>
        </>}
        {notice && <p className="evidence-notice"><CircleAlert size={14}/>{notice}</p>}
        {review && <div className={`evidence-review outcome-${review.review.outcome}`} role="region" aria-label="Uygulama kanıtı inceleme sonucu">
          <b>{review.review.outcome === 'ready_for_approval' ? 'Onaya hazır' : review.review.outcome === 'blocked' ? 'Engellendi' : 'Düzeltme gerekli'}</b>
          {review.review.findings.length ? <ul>{review.review.findings.map(finding => <li key={finding}>{finding}</li>)}</ul> : <p>Dosya kapsamı, doğrulamalar ve kabul kriterleri TaskContract ile uyumlu.</p>}
          <label>İnceleyen notu<input aria-label="Kanıt inceleyen notu" value={reviewerNote} onChange={event => setReviewerNote(event.target.value)} placeholder="İsteğe bağlı karar notu"/></label>
          <div className="evidence-actions">
            <button type="button" onClick={() => decide('reject')}><X size={14}/> Reddet</button>
            <button type="button" className="primary" disabled={review.review.outcome !== 'ready_for_approval'} onClick={() => decide('accept')}><Check size={14}/> Onayla ve görevi tamamla</button>
          </div>
        </div>}
      </div>
    </details>
  );
}
