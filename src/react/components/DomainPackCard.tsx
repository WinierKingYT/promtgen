import { useMemo, useState } from 'react';
import { Check, CheckCircle2, CircleAlert, Layers3, ShieldCheck } from 'lucide-react';
import type { ProjectDocumentV5 } from '../../v4/contracts.js';
import { assessWebSaasPack } from '../../v4/domain-packs/web-saas.js';
import { applyModuleActivation, previewModuleActivation } from '../../v4/module-registry.js';

interface DomainPackCardProps {
  project: ProjectDocumentV5;
  onCommit: (project: ProjectDocumentV5, message: string, commandType?: string) => void;
  onSection: (sectionId: string) => void;
}

export function DomainPackCard({ project, onCommit, onSection }: DomainPackCardProps) {
  const assessment = useMemo(() => assessWebSaasPack(project), [project]);
  const [preview, setPreview] = useState<ReturnType<typeof previewModuleActivation> | null>(null);
  const [error, setError] = useState('');

  if (!assessment.applicable && !assessment.active) return null;

  const passed = assessment.checks.filter(item => item.passed).length;
  const prepare = () => {
    const next = previewModuleActivation(project, ['software.web']);
    setPreview(next);
    setError(next.errors.join(' '));
  };
  const approve = () => {
    if (!preview) return;
    const result = applyModuleActivation(project, preview, { approved: true });
    if (!result.success) {
      setError(result.reason);
      return;
    }
    onCommit(result.project, 'Web/SaaS planlama paketi kullanıcı onayıyla etkinleştirildi.', 'ApplyWebSaasDomainPack');
    setPreview(null);
    setError('');
  };

  return (
    <section className={`domain-pack-card ${assessment.active ? 'active' : ''}`} aria-labelledby="web-saas-pack-title">
      <div className="domain-pack-heading">
        <span className="domain-pack-icon">{assessment.active ? <ShieldCheck size={18} /> : <Layers3 size={18} />}</span>
        <span>
          <small>{assessment.maturity === 'stable' ? 'KARARLI ALAN DESTEĞİ' : assessment.maturity === 'candidate-stable' ? 'KARARLI ADAYI · KURAL PAKETİ' : assessment.maturity.toUpperCase()}</small>
          <b id="web-saas-pack-title">Web/SaaS Planlama Paketi</b>
        </span>
        {assessment.active && <em>{passed}/{assessment.checks.length}</em>}
      </div>

      {!assessment.active && !preview && (
        <>
          <p>Fikir web/SaaS sinyalleri taşıyor. Paket; doğru alan sorularını, kalite kapılarını ve görev doğrulamalarını ekler. Canonical plana otomatik karar yazmaz.</p>
          <button type="button" onClick={prepare}>Paket katkılarını incele</button>
        </>
      )}

      {!assessment.active && preview && (
        <div className="domain-pack-preview" role="region" aria-label="Web SaaS paket aktivasyon önizlemesi">
          <b>{preview.moduleIds.join(' → ')}</b>
          {preview.upgrades.length > 0 && <small>{preview.upgrades.map(item => `${item.id} ${item.fromVersion} → ${item.toVersion}`).join(', ')} yükseltmesi</small>}
          <small>{preview.domainQuestions.length} alan sorusu · {preview.requiredSections.length} zorunlu bölüm</small>
          <ul>
            {preview.domainQuestions.slice(0, 4).map(question => <li key={question.id}>{question.prompt}</li>)}
          </ul>
          {preview.limitations.map((limitation) => (
            <p key={limitation}><CircleAlert size={13} /> {limitation}</p>
          ))}
          <div>
            <button type="button" onClick={() => setPreview(null)}>Vazgeç</button>
            <button type="button" className="primary" disabled={preview.errors.length > 0} onClick={approve}><Check size={14} /> Paketi onayla</button>
          </div>
        </div>
      )}

      {assessment.active && (
        <>
          <p>Alan kuralları readiness, plan incelemesi, görev sözleşmeleri ve test türlerinde etkin.</p>
          <ul className="domain-pack-checks">
            {assessment.checks.map(item => (
              <li key={item.id} className={item.passed ? 'passed' : item.blocking ? 'blocked' : 'warning'}>
                {item.passed ? <CheckCircle2 size={13} /> : <CircleAlert size={13} />}
                <button type="button" onClick={() => onSection(item.sectionId)}>
                  <b>{item.label}</b>
                  <small>{item.passed ? 'Doğrulandı' : `${item.message} · bölümü aç`}</small>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {error && <p className="domain-pack-error" role="alert">{error}</p>}
    </section>
  );
}
