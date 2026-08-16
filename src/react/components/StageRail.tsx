import { Check, Circle, Dot, Lock } from 'lucide-react';
import { stageRail } from '../../v4/application/workspace-stages.js';
import type { ProjectDocumentV5 } from '../../v4/contracts.js';
import type { StageProgressGroup } from '../../v4/application/workspace-stages.js';

/**
 * Üst düzey aşama rayı: `FİKİR · ÇÖZÜM · PLAN · DEVİR`.
 *
 * Bileşen karar vermez — ne göstereceğini `workspace-stages` söyler. Böylece
 * "hangi aşama açık", "kilitliyse neden", "şu an ne konuşuluyor" soruları DOM'a
 * ihtiyaç duymadan test edilebiliyor.
 *
 * **Kilitli aşama `disabled` değildir.** Daha önce bunu denedik: `disabled`
 * ekranı klavye ve ekran okuyucudan tamamen sakladı, `aria-disabled` ise
 * otomasyonu kilitledi. Kilit bir **içeriktir**: solgun görünür, nedeni
 * yazılır ve okunabilir kalır.
 */
function GroupIcon({ state }: { state: StageProgressGroup['state'] }) {
  if (state === 'done') return <Check size={13} aria-hidden="true" />;
  if (state === 'active') return <Dot size={13} aria-hidden="true" />;
  return <Circle size={13} aria-hidden="true" />;
}

export function StageRail({ project }: { project: ProjectDocumentV5 }) {
  const stages = stageRail(project);

  return <nav className="pg-stage-rail" aria-label="Proje aşamaları">
    <ol>
      {stages.map(stage => (
        <li key={stage.id} className={`pg-stage is-${stage.state}`}>
          <div className="pg-stage-head">
            <b>{stage.label}</b>
            {stage.state === 'locked' && <Lock size={13} aria-hidden="true" />}
            {stage.state === 'done' && <Check size={13} aria-hidden="true" />}
          </div>

          {stage.state === 'current' && <p className="pg-stage-caption">{stage.caption}</p>}
          {stage.lockReason && <p className="pg-stage-lock">{stage.lockReason}</p>}

          {stage.groups.length > 0 && (
            <ul className="pg-stage-groups">
              {stage.groups.map(group => (
                <li key={group.label} className={`is-${group.state}`}>
                  <GroupIcon state={group.state} />
                  <span>{group.label}</span>
                </li>
              ))}
            </ul>
          )}

          {stage.lines.length > 0 && (
            <ul className="pg-stage-lines">
              {stage.lines.map(line => <li key={line}>{line}</li>)}
            </ul>
          )}
        </li>
      ))}
    </ol>
  </nav>;
}
