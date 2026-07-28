import { useEffect, useState } from 'react';
import { Check, CircleAlert, FileCheck2, Plus, Save, Trash2 } from 'lucide-react';
import type { ProjectDocumentV5, Requirement } from '../../v4/contracts.js';
import {
  acceptRequirementDraft,
  createRequirementDraftsFromConcept,
  evaluateRequirementQuality,
  removeRequirementDraft,
  updateRequirementDraft
} from '../../v4/application/requirement-quality-service.js';
import { recalculateReadiness } from '../../v4/planning-engine.js';

type Commit = (project: ProjectDocumentV5, message?: string, commandType?: string) => void;

function RequirementCard({ project, requirement, onCommit }: {
  project: ProjectDocumentV5;
  requirement: Requirement;
  onCommit: Commit;
}) {
  const [draft, setDraft] = useState({
    title: requirement.title,
    statement: requirement.statement,
    kind: requirement.kind,
    priority: requirement.priority,
    acceptanceCriteria: requirement.acceptanceCriteria.join('\n'),
    sourceObjectiveId: requirement.sourceObjectiveIds[0] || ''
  });
  const [error, setError] = useState('');
  const accepted = requirement.status === 'accepted';
  useEffect(() => {
    setDraft({
      title: requirement.title,
      statement: requirement.statement,
      kind: requirement.kind,
      priority: requirement.priority,
      acceptanceCriteria: requirement.acceptanceCriteria.join('\n'),
      sourceObjectiveId: requirement.sourceObjectiveIds[0] || ''
    });
    setError('');
  }, [project.documentRevision, requirement]);

  const changes = {
    title: draft.title,
    statement: draft.statement,
    kind: draft.kind,
    priority: draft.priority,
    acceptanceCriteria: draft.acceptanceCriteria.split('\n').map(item => item.trim()).filter(Boolean),
    sourceObjectiveIds: draft.sourceObjectiveId ? [draft.sourceObjectiveId] : []
  };
  const save = () => {
    const next = recalculateReadiness(updateRequirementDraft(project, requirement.id, changes));
    onCommit(next, 'Gereksinim taslağı güncellendi.', 'UpdateRequirementDraft');
  };
  const accept = () => {
    try {
      const updated = updateRequirementDraft(project, requirement.id, changes);
      const next = recalculateReadiness(acceptRequirementDraft(updated, requirement.id));
      onCommit(next, 'Gereksinim kullanıcı tarafından kabul edildi.', 'AcceptRequirement');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };
  const remove = () => {
    const next = recalculateReadiness(removeRequirementDraft(project, requirement.id));
    onCommit(next, 'Gereksinim taslağı kaldırıldı.', 'RemoveRequirementDraft');
  };

  return <article className={`requirement-card ${accepted ? 'accepted' : 'draft'}`}>
    <header>
      <span>{accepted ? 'KABUL EDİLDİ' : 'KULLANICI ONAYI BEKLİYOR'}</span>
      <b>{requirement.id}</b>
    </header>
    <div className="requirement-fields">
      <label>Başlık<input disabled={accepted} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })}/></label>
      <label>Tür<select disabled={accepted} value={draft.kind} onChange={event => setDraft({ ...draft, kind: event.target.value as Requirement['kind'] })}><option value="functional">Fonksiyonel</option><option value="quality">Kalite</option><option value="constraint">Kısıt</option></select></label>
      <label>Öncelik<select disabled={accepted} value={draft.priority} onChange={event => setDraft({ ...draft, priority: event.target.value as Requirement['priority'] })}><option value="must">Must</option><option value="should">Should</option><option value="could">Could</option></select></label>
      <label className="wide">Gereksinim ifadesi<textarea disabled={accepted} value={draft.statement} onChange={event => setDraft({ ...draft, statement: event.target.value })}/></label>
      <label className="wide">Kabul kriterleri<small>Her satıra gözlenebilir bir sonuç</small><textarea disabled={accepted} value={draft.acceptanceCriteria} onChange={event => setDraft({ ...draft, acceptanceCriteria: event.target.value })}/></label>
      {project.objectives.some(item => item.status === 'accepted') && <label className="wide">Kaynak hedef<select disabled={accepted} value={draft.sourceObjectiveId} onChange={event => setDraft({ ...draft, sourceObjectiveId: event.target.value })}><option value="">Hedef seç</option>{project.objectives.filter(item => item.status === 'accepted').map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
    </div>
    {error && <p className="requirement-error" role="alert"><CircleAlert size={14}/>{error}</p>}
    {!accepted && <footer>
      <button type="button" className="danger-quiet" onClick={remove}><Trash2 size={14}/> Kaldır</button>
      <button type="button" onClick={save}><Save size={14}/> Taslağı kaydet</button>
      <button type="button" className="primary" onClick={accept}><Check size={14}/> Gereksinimi kabul et</button>
    </footer>}
  </article>;
}

export function RequirementQualityPanel({ project, onCommit }: {
  project: ProjectDocumentV5;
  onCommit: Commit;
}) {
  const quality = evaluateRequirementQuality(project);
  const createDrafts = () => {
    try {
      const next = recalculateReadiness(createRequirementDraftsFromConcept(project));
      onCommit(next, 'MVP kapsamından gereksinim taslakları oluşturuldu.', 'GenerateRequirementDrafts');
    } catch (reason) {
      window.alert(reason instanceof Error ? reason.message : String(reason));
    }
  };

  return <section className="requirement-quality" aria-labelledby="requirement-quality-title">
    <header>
      <div><span className="meta">MVP → GEREKSİNİM → GÖREV → TEST</span><h2 id="requirement-quality-title"><FileCheck2 size={18}/> Gereksinim Kalite Kapısı</h2></div>
      <div className="requirement-quality-counts"><span>{quality.draftCount} taslak</span><span>{quality.acceptedCount} kabul</span><span>{quality.mustCount} must</span></div>
    </header>
    <p>PromtGen taslak önerir; yalnız senin kabul ettiğin, kabul kriteri bulunan gereksinimler görev üretiminde kullanılır.</p>
    {!project.requirements.length && <div className="requirement-empty">
      <span>Onaylanmış MVP kapsamından düzenlenebilir gereksinim taslakları oluştur.</span>
      <button type="button" className="primary" onClick={createDrafts}><Plus size={15}/> MVP’den taslak üret</button>
    </div>}
    {project.requirements.length > 0 && <>
      <div className={`requirement-gate-state ${quality.readyForTaskCompilation ? 'ready' : 'blocked'}`}>
        {quality.readyForTaskCompilation ? <Check size={15}/> : <CircleAlert size={15}/>}
        <span><b>{quality.readyForTaskCompilation ? 'Görev üretimine hazır' : 'Görev üretimi henüz kapalı'}</b><small>{quality.readyForFinalization ? 'Must gereksinimlerin görev ve test bağlantıları tamamlandı.' : quality.issues[0] || 'Görev ve test bağlantıları oluşturulmalı.'}</small></span>
      </div>
      <div className="requirement-list">{project.requirements.map(requirement => <RequirementCard key={requirement.id} project={project} requirement={requirement} onCommit={onCommit}/>)}</div>
    </>}
  </section>;
}
