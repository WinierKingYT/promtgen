import { useMemo, useState } from 'react';
import { Check, RefreshCw, WandSparkles, X } from 'lucide-react';
import {
  applySectionPatchProposals,
  generateSectionPatchProposals,
  setSectionPatchStatus
} from '../../v4/application/section-regeneration-service.js';
import type { CredentialVault } from '../../v4/credential-vault.js';
import type { ProjectDocumentV5, SectionPatchProposal } from '../../v4/contracts.js';
import { getProviderMeta, type ProviderSettings } from '../../v4/provider-settings.js';
import { ProvenanceBadge } from './ProvenanceBadge.js';

type Commit = (project: ProjectDocumentV5, message?: string, commandType?: string) => Promise<void> | void;

export function SectionRegenerationPanel({ project, onCommit, providerSettings, credentialVault }: {
  project: ProjectDocumentV5;
  onCommit: Commit;
  providerSettings: ProviderSettings;
  credentialVault: CredentialVault;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const impact = useMemo(() => [...(project.impactAnalyses || [])].reverse().find(item => item.status === 'accepted') || null, [project.impactAnalyses]);
  const proposals = impact ? project.sectionPatchProposals.filter(item => item.impactAnalysisId === impact.id && item.status !== 'stale') : [];
  const pending = proposals.filter(item => item.status === 'pending').length;
  const approved = proposals.filter(item => item.status === 'accepted' || item.status === 'edited').length;

  const generate = async () => {
    if (!impact) return;
    setBusy(true);
    setError('');
    try {
      const credential = await credentialVault.get(providerSettings.providerId) || '';
      const result = await generateSectionPatchProposals(project, impact.id, { settings: providerSettings, credential });
      await onCommit(
        result.project,
        result.usedFallback
          ? `Bölüm patch’leri yerel motorla hazırlandı${result.error ? `: ${result.error}` : '.'}`
          : `${getProviderMeta(providerSettings.providerId).label} bölüm patch’lerini hazırladı.`,
        'GenerateSectionPatches'
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const decide = (proposal: SectionPatchProposal, status: SectionPatchProposal['status'], content = '') => {
    try {
      onCommit(setSectionPatchStatus(project, proposal.id, status, content), 'Bölüm patch kararı kaydedildi.', 'UpdateSectionPatchStatus');
      setEditingId('');
      setEditedContent('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const apply = () => {
    if (!impact) return;
    const result = applySectionPatchProposals(project, impact.id);
    if (!result.success) {
      setError(result.reason);
      if (result.project !== project) onCommit(result.project, result.reason, 'MarkSectionPatchesStale');
      return;
    }
    onCommit(result.project, `${approved} plan bölümü senin onayınla güncellendi.`, 'ApplySectionPatches');
  };

  return (
    <section className="section-regeneration" aria-labelledby="section-regeneration-title">
      <header><div><span className="meta">KONTROLLÜ AI GÜNCELLEMESİ</span><h3 id="section-regeneration-title"><WandSparkles size={16}/> Etkilenen plan bölümleri</h3></div><button type="button" disabled={!impact || busy} onClick={generate}><RefreshCw size={13}/>{busy ? 'Hazırlanıyor…' : proposals.length ? 'Yeniden üret' : 'Patch üret'}</button></header>
      {!impact && <p>Önce bir plan değişikliği etki analiziyle kabul edilmelidir.</p>}
      {impact && <p><b>{impact.userRequest}</b> için AI veya yerel motor yalnız öneri üretir; hiçbir bölüm kullanıcı onayı olmadan değişmez.</p>}
      {error && <p className="section-regeneration-error" role="alert">{error}</p>}
      <div className="section-patch-list">{proposals.map(proposal => {
        const provenanceKind = proposal.provenance.mode === 'fallback' ? 'degraded' : proposal.provenance.mode === 'rule-engine' ? 'local-rule' : 'ai-proposed';
        return <article key={proposal.id} className={`section-patch ${proposal.status}`}>
          <header><div><span className="meta">{project.sections[proposal.sectionId]?.title || proposal.sectionId}</span><b>{proposal.rationale}</b></div><ProvenanceBadge kind={provenanceKind} providerName={proposal.provenance.providerId || undefined}/></header>
          <div className="section-patch-diff"><div><small>MEVCUT r{proposal.baseCanonicalRevision}</small><pre>{proposal.originalContent || '—'}</pre></div><div><small>ÖNERİLEN</small><pre>{proposal.proposedContent}</pre></div></div>
          {proposal.warnings.length > 0 && <ul>{proposal.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
          {editingId === proposal.id && <label>Düzenlenmiş plan içeriği<textarea value={editedContent} onChange={event => setEditedContent(event.target.value)} rows={7}/></label>}
          {proposal.status === 'pending' && <footer>
            <button type="button" onClick={() => decide(proposal, 'rejected')}><X size={13}/> Reddet</button>
            <button type="button" onClick={() => decide(proposal, 'deferred')}>Ertele</button>
            <button type="button" onClick={() => { setEditingId(proposal.id); setEditedContent(proposal.proposedContent); }}>Düzenle</button>
            {editingId === proposal.id && <button type="button" onClick={() => decide(proposal, 'edited', editedContent)}>Düzenlemeyi kabul et</button>}
            <button type="button" className="primary" onClick={() => decide(proposal, 'accepted')}><Check size={13}/> Kabul et</button>
          </footer>}
          {proposal.status !== 'pending' && <em>{proposal.status}</em>}
        </article>;
      })}</div>
      {proposals.length > 0 && <div className="section-patch-apply"><span>{pending ? `${pending} bölüm karar bekliyor` : `${approved} bölüm uygulanacak`}</span><button type="button" className="primary" disabled={pending > 0 || approved === 0} onClick={apply}>Onaylanan bölümleri atomik uygula</button></div>}
    </section>
  );
}
