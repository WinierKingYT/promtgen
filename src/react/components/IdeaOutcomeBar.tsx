import { useMemo, useState } from 'react';
import { ArrowRight, Download, FileText, Lightbulb, ListChecks } from 'lucide-react';
import type { ProjectDocumentV5 } from '../../v4/contracts.js';
import {
  buildAnonymousStudySession,
  buildIdeaGuide,
  ideaGuideToMarkdown
} from '../../v4/application/idea-guide-service.js';

export type IdeaOutcome = 'develop' | 'guide' | 'plan';

const outcomes: Array<{ id: IdeaOutcome; title: string; detail: string; icon: typeof Lightbulb }> = [
  { id: 'develop', title: 'Fikri geliştir', detail: 'Konuş, seçenekleri karşılaştır ve fikri netleştir.', icon: Lightbulb },
  { id: 'guide', title: 'Rehber oluştur', detail: 'Fikri anlaşılır bir “ne ve nasıl” belgesine dönüştür.', icon: FileText },
  { id: 'plan', title: 'Detaylı planla', detail: 'Kapsam, gereksinim, görev ve test planına geç.', icon: ListChecks }
];

const downloadText = (content: string, filename: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export function IdeaOutcomeBar({ value, onChange }: { value: IdeaOutcome; onChange: (value: IdeaOutcome) => void }) {
  return (
    <nav className="idea-outcomes" aria-label="Fikrinle ne yapmak istiyorsun?">
      <div><span className="meta">ÇIKIŞINI SEÇ</span><b>Fikrinle şimdi ne yapmak istiyorsun?</b></div>
      <div className="idea-outcome-options">
        {outcomes.map(({ id, title, detail, icon: Icon }) => (
          <button key={id} type="button" className={value === id ? 'active' : ''} aria-current={value === id ? 'step' : undefined} onClick={() => onChange(id)}>
            <Icon size={18}/><span><b>{title}</b><small>{detail}</small></span><ArrowRight size={15}/>
          </button>
        ))}
      </div>
    </nav>
  );
}

export function IdeaGuidePanel({ project }: { project: ProjectDocumentV5 }) {
  const guide = useMemo(() => buildIdeaGuide(project), [project]);
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(4);
  const list = (title: string, items: string[]) => <section><h3>{title}</h3><ul>{items.map(item => <li key={item}>{item}</li>)}</ul></section>;

  return (
    <article className="idea-guide" aria-labelledby="idea-guide-title">
      <header><span className="meta">FİKİR REHBERİ · CANONICAL PLANI DEĞİŞTİRMEZ</span><h2 id="idea-guide-title">{guide.title}</h2><p>{guide.improvedIdea}</p></header>
      <div className="idea-guide-facts"><section><h3>Kim için?</h3><p>{guide.targetUser}</p></section><section><h3>Hangi problem?</h3><p>{guide.problem}</p></section></div>
      <div className="idea-guide-grid">{list('İlk sürümde', guide.mvp)}{list('Şimdilik dışında', guide.outOfScope)}{list('Riskler', guide.risks)}{list('Sıradaki adımlar', guide.nextSteps)}</div>
      <div className="idea-guide-actions">
        <button className="primary" type="button" onClick={() => downloadText(ideaGuideToMarkdown(guide), `${project.identity.name}-fikir-rehberi.md`, 'text/markdown')}>
          <Download size={16}/> Rehberi indir
        </button>
        <details>
          <summary>İsteğe bağlı yerel kullanım özeti</summary>
          <p>Hiçbir veri gönderilmez. Puanınla birlikte kişisel bilgi içermeyen JSON dosyası yalnız cihazına indirilir.</p>
          <label>Deneyim puanı <select value={rating} onChange={event => setRating(Number(event.target.value) as 1 | 2 | 3 | 4 | 5)}>{[1, 2, 3, 4, 5].map(value => <option key={value}>{value}</option>)}</select></label>
          <button type="button" onClick={() => downloadText(JSON.stringify(buildAnonymousStudySession(project, rating), null, 2), 'promtgen-anonim-oturum.json', 'application/json')}>Anonim özeti indir</button>
        </details>
      </div>
    </article>
  );
}
