import { useMemo, useState } from 'react';
import { Check, GitCompare, History, RotateCcw, X } from 'lucide-react';
import type { ProjectDocumentV5 } from '../../v4/contracts.js';
import {
  compareIdeaDocumentRevisions,
  restoreIdeaDocumentRevision
} from '../../v4/application/idea-document-revision-service.js';

export function IdeaDocumentHistoryPanel({ project, onCommit }: {
  project: ProjectDocumentV5;
  onCommit: (project: ProjectDocumentV5, message?: string, commandType?: string) => void;
}) {
  const revisions = [...project.ideaDocumentRevisions].sort((left, right) => right.number - left.number);
  const [selectedId, setSelectedId] = useState(revisions[1]?.id || revisions[0]?.id || '');
  const [restoreId, setRestoreId] = useState('');
  const [notice, setNotice] = useState('');
  const latest = revisions[0];
  const comparison = useMemo(
    () => latest && selectedId ? compareIdeaDocumentRevisions(project, selectedId, latest.id) : null,
    [latest, project, selectedId]
  );

  if (revisions.length === 0) return null;

  const restore = () => {
    const result = restoreIdeaDocumentRevision(project, restoreId);
    if (!result.success) {
      setNotice(result.reason);
      setRestoreId('');
      return;
    }
    onCommit(result.project, `Fikir belgesi r${result.project.ideaDocumentRevisions.at(-1)?.restoredFromRevision} sürümünden geri yüklendi.`, 'RestoreIdeaDocumentRevision');
    setNotice(result.canonicalPlanUnchanged
      ? 'Fikir özeti geri yüklendi. Planın kendisi değişmedi; sonraki adımda etkisini gözden geçirmeni önereceğiz.'
      : 'Fikir belgesi yeni bir sürüm olarak geri yüklendi.');
    setRestoreId('');
  };

  return <details className="idea-history">
    <summary><span><History size={16}/><b>Fikir belgesi geçmişi</b></span><small>{revisions.length} sürüm</small></summary>
    <div className="idea-history-body">
      <div className="idea-history-list" role="list" aria-label="Fikir belgesi sürümleri">
        {revisions.map(revision => <button
          key={revision.id}
          type="button"
          role="listitem"
          className={selectedId === revision.id ? 'active' : ''}
          onClick={() => setSelectedId(revision.id)}
        >
          <span><b>r{revision.number}</b>{revision.status === 'converted' && <em><Check size={12}/> Plana dönüştürüldü</em>}</span>
          <small>{revision.summary} · {new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(revision.createdAt))}</small>
        </button>)}
      </div>
      {comparison?.valid && <section className="idea-history-diff" aria-live="polite">
        <h4><GitCompare size={15}/> r{comparison.from.number} → r{comparison.to.number}</h4>
        {comparison.changes.length === 0
          ? <p>Bu sürüm ile güncel fikir belgesi arasında içerik farkı yok.</p>
          : comparison.changes.map(change => <div key={change.field}>
              <b>{change.label}</b>
              <del>{change.before || 'Boş'}</del>
              <ins>{change.after || 'Boş'}</ins>
            </div>)}
        {comparison.from.id !== latest.id && <button type="button" onClick={() => setRestoreId(comparison.from.id)}><RotateCcw size={14}/> Bu sürümü geri yükle</button>}
      </section>}
      {restoreId && <div className="idea-history-confirm" role="alert">
        <p><b>Eski sürüm yeni kayıt olarak geri yüklenecek.</b> Mevcut planın üzerine yazılmayacak.</p>
        <button type="button" onClick={restore}><Check size={14}/> Geri yükle</button>
        <button type="button" onClick={() => setRestoreId('')}><X size={14}/> Vazgeç</button>
      </div>}
      {notice && <p className="idea-history-notice" role="status">{notice}</p>}
    </div>
  </details>;
}
