import { useState } from 'react';
import { ArrowRight, GitCompareArrows, Plus, Trash2 } from 'lucide-react';
import { generateImpactAnalysis } from '../../v4/ai-discovery.js';
import {
  createPlanningScenario,
  discardPlanningScenario,
  linkScenarioImpact,
  selectPlanningScenario
} from '../../v4/application/planning-scenario-service.js';
import type { ProjectDocumentV5 } from '../../v4/contracts.js';

type Commit = (project: ProjectDocumentV5, message?: string, commandType?: string) => Promise<void> | void;

function scoreLabel(score: number) {
  return ['—', 'Çok düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok yüksek'][score] || String(score);
}

export function PlanningScenarioPanel({ project, onCommit }: { project: ProjectDocumentV5; onCommit: Commit }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [decision, setDecision] = useState('');
  const [rationale, setRationale] = useState('');
  const [sections, setSections] = useState('scope, requirements, architecture');
  const [dependencies, setDependencies] = useState('');
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const scenarios = [...(project.planningScenarios || [])].reverse();

  const create = () => {
    setError('');
    try {
      const result = createPlanningScenario(project, {
        name,
        description,
        decisions: [{
          title: name || 'Alternatif karar',
          decision,
          rationale,
          affectedSectionIds: sections.split(',').map(item => item.trim()).filter(Boolean),
          dependencies: dependencies.split(',').map(item => item.trim()).filter(Boolean)
        }]
      });
      onCommit(result.project, `"${result.scenario.name}" senaryosu canonical plan değiştirilmeden kaydedildi.`, 'CreatePlanningScenario');
      setName(''); setDescription(''); setDecision(''); setRationale(''); setDependencies(''); setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const prepareMerge = async (scenarioId: string) => {
    setBusyId(scenarioId);
    setError('');
    try {
      const selected = selectPlanningScenario(project, scenarioId);
      if (!selected.success) {
        setError(selected.reason);
        return;
      }
      const generated = await generateImpactAnalysis(selected.project, selected.request, { pendingCommit: true });
      const linked = linkScenarioImpact(generated.project, scenarioId, generated.impact.id);
      await onCommit(linked, 'Senaryo etki analizine dönüştürüldü; açık onay olmadan canonical plana uygulanmayacak.', 'SelectPlanningScenario');
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className="scenario-panel" aria-labelledby="scenario-panel-title">
      <header><div><span className="meta">ALTERNATİF PLAN DALLARI</span><h3 id="scenario-panel-title"><GitCompareArrows size={16}/> Senaryo laboratuvarı</h3></div><button type="button" onClick={() => setOpen(value => !value)}><Plus size={14}/>{open ? 'Formu kapat' : 'Yeni senaryo'}</button></header>
      <p>Alternatifleri canonical planı değiştirmeden karşılaştır. Seçilen senaryo önce etki analizi ve kullanıcı onayına gider.</p>
      {open && <div className="scenario-form">
        <label>Senaryo adı<input value={name} onChange={event => setName(event.target.value)} placeholder="Örn. Sunucu otoriteli hareket"/></label>
        <label>Amaç ve fark<textarea value={description} onChange={event => setDescription(event.target.value)} rows={2}/></label>
        <label>Alternatif karar<textarea value={decision} onChange={event => setDecision(event.target.value)} rows={3}/></label>
        <label>Gerekçe<textarea value={rationale} onChange={event => setRationale(event.target.value)} rows={2}/></label>
        <label>Etkilenen bölümler<input value={sections} onChange={event => setSections(event.target.value)}/></label>
        <label>Bağımlılıklar<input value={dependencies} onChange={event => setDependencies(event.target.value)} placeholder="Virgülle ayır"/></label>
        <button type="button" className="primary" disabled={!name.trim() || !decision.trim() || !rationale.trim()} onClick={create}>Canonical planı değiştirmeden kaydet</button>
      </div>}
      {error && <p className="scenario-error" role="alert">{error}</p>}
      <div className="scenario-grid">{scenarios.map(scenario => <article key={scenario.id} className={`scenario-card ${scenario.status}`}>
        <div><span>{scenario.status}</span><small>Kaynak r{scenario.baseCanonicalRevision}</small></div>
        <h4>{scenario.name}</h4><p>{scenario.description || scenario.decisions[0]?.decision}</p>
        <dl><div><dt>Efor</dt><dd>{scoreLabel(scenario.comparison.effortScore)}</dd></div><div><dt>Risk</dt><dd>{scoreLabel(scenario.comparison.riskScore)}</dd></div><div><dt>Hazırlık etkisi</dt><dd>{scenario.comparison.readinessDelta > 0 ? '+' : ''}{scenario.comparison.readinessDelta}</dd></div></dl>
        <small>{scenario.comparison.affectedSectionIds.join(' · ') || 'Bölüm belirtilmedi'}</small>
        {scenario.status === 'draft' && <footer><button type="button" onClick={() => onCommit(discardPlanningScenario(project, scenario.id), 'Senaryo geçmişte korunarak elendi.', 'DiscardPlanningScenario')}><Trash2 size={13}/> Ele</button><button type="button" className="primary" disabled={Boolean(busyId)} onClick={() => prepareMerge(scenario.id)}>{busyId === scenario.id ? 'Analiz ediliyor…' : 'Etki analizine gönder'}<ArrowRight size={13}/></button></footer>}
        {scenario.status === 'selected' && <em>Etki analizi kullanıcı kararı bekliyor.</em>}
        {scenario.status === 'merged' && <em>Canonical plana onayla birleştirildi.</em>}
      </article>)}</div>
      {!scenarios.length && <small className="scenario-empty">Henüz alternatif senaryo yok.</small>}
    </section>
  );
}
