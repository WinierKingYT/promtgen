import { useMemo, useState } from 'react';
import { Check, CheckCircle2, CircleAlert, Layers3, ShieldCheck } from 'lucide-react';
import type { ProjectDocumentV5 } from '../../v4/contracts.js';
import {
  DOMAIN_PACK_REGISTRY,
  type DomainPackAssessment,
  type DomainPackRuntime
} from '../../v4/domain-packs/registry.js';
import { applyModuleActivation, previewModuleActivation } from '../../v4/module-registry.js';

interface DomainPackCardProps {
  project: ProjectDocumentV5;
  onCommit: (project: ProjectDocumentV5, message: string, commandType?: string) => void;
  onSection: (sectionId: string) => void;
}

interface PackDescriptor {
  moduleId: string;
  title: string;
  titleId: string;
  previewLabel: string;
  activationMessage: string;
  commandType: string;
  description: string;
  activeDescription: string;
  assessment: DomainPackAssessment;
}

function maturityLabel(maturity: DomainPackAssessment['maturity']): string {
  if (maturity === 'stable') return 'KARARLI ALAN DESTEĞİ';
  if (maturity === 'candidate-stable') return 'KARARLI ADAYI · KURAL PAKETİ';
  if (maturity === 'beta') return 'BETA · KURAL PAKETİ';
  return maturity.toUpperCase();
}

function DomainPackItem({ project, onCommit, onSection, descriptor }: DomainPackCardProps & { descriptor: PackDescriptor }) {
  const { assessment } = descriptor;
  const [preview, setPreview] = useState<ReturnType<typeof previewModuleActivation> | null>(null);
  const [error, setError] = useState('');
  const passed = assessment.checks.filter(item => item.passed).length;

  const prepare = () => {
    const next = previewModuleActivation(project, [descriptor.moduleId]);
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
    onCommit(result.project, descriptor.activationMessage, descriptor.commandType);
    setPreview(null);
    setError('');
  };

  return (
    <section className={`domain-pack-card ${assessment.active ? 'active' : ''}`} aria-labelledby={descriptor.titleId}>
      <div className="domain-pack-heading">
        <span className="domain-pack-icon">{assessment.active ? <ShieldCheck size={18} /> : <Layers3 size={18} />}</span>
        <span>
          <small>{maturityLabel(assessment.maturity)}</small>
          <b id={descriptor.titleId}>{descriptor.title}</b>
        </span>
        {assessment.active && <em>{passed}/{assessment.checks.length}</em>}
      </div>

      {!assessment.active && !preview && (
        <>
          <p>{descriptor.description}</p>
          <button type="button" onClick={prepare}>Paket katkılarını incele</button>
        </>
      )}

      {!assessment.active && preview && (
        <div className="domain-pack-preview" role="region" aria-label={descriptor.previewLabel}>
          <b>{preview.moduleIds.join(' → ')}</b>
          {preview.upgrades.length > 0 && <small>{preview.upgrades.map(item => `${item.id} ${item.fromVersion} → ${item.toVersion}`).join(', ')} yükseltmesi</small>}
          <small>{preview.domainQuestions.length} alan sorusu · {preview.requiredSections.length} zorunlu bölüm</small>
          <ul>
            {preview.domainQuestions.slice(0, 5).map(question => <li key={question.id}>{question.prompt}</li>)}
          </ul>
          {preview.limitations.map(limitation => (
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
          <p>{descriptor.activeDescription}</p>
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

export function DomainPackCard(props: DomainPackCardProps) {
  const visible = useMemo<PackDescriptor[]>(() =>
    DOMAIN_PACK_REGISTRY.applicable(props.project).map((runtime: DomainPackRuntime) => ({
      moduleId: runtime.module.id,
      title: runtime.module.name,
      ...runtime.ui,
      assessment: runtime.assess(props.project)
    })), [props.project]);
  if (!visible.length) return null;
  return <div className="domain-pack-list">{visible.map(descriptor => <DomainPackItem key={descriptor.moduleId} {...props} descriptor={descriptor} />)}</div>;
}
