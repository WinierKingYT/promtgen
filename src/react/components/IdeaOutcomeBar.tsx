import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, CircleAlert, Download, Eye, FileText, Lightbulb, ListChecks, RotateCcw } from 'lucide-react';
import type { ProjectDocumentV5 } from '../../v4/contracts.js';
import {
  buildAnonymousStudySession,
  buildIdeaGuide,
  ideaGuideToMarkdown
} from '../../v4/application/idea-guide-service.js';
import {
  previewIdeaPlanConversion,
  type IdeaPlanConversionPreview
} from '../../v4/application/idea-plan-conversion-service.js';
import { ConceptAgreementEditor } from './ConceptAgreementEditor.js';
import { IdeaDocumentHistoryPanel } from './IdeaDocumentHistoryPanel.js';

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

export function IdeaGuidePanel({ project, onCommit, onConvert, onOpenPlan }: {
  project: ProjectDocumentV5;
  onCommit: (project: ProjectDocumentV5, message?: string, commandType?: string) => void;
  onConvert: (preview: IdeaPlanConversionPreview) => Promise<boolean>;
  onOpenPlan: () => void;
}) {
  const guide = useMemo(() => buildIdeaGuide(project), [project]);
  const conversion = useMemo(() => previewIdeaPlanConversion(project), [project]);
  const [conversionPreview, setConversionPreview] = useState<IdeaPlanConversionPreview | null>(null);
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [converting, setConverting] = useState(false);
  useEffect(() => setConversionPreview(null), [project.id, project.documentRevision, project.canonicalRevision]);
  const list = (title: string, items: string[]) => <section><h3>{title}</h3><ul>{items.map(item => <li key={item}>{item}</li>)}</ul></section>;
  const convert = async () => {
    if (!conversionPreview || converting) return;
    setConverting(true);
    try {
      if (await onConvert(conversionPreview)) onOpenPlan();
    } finally {
      setConverting(false);
    }
  };

  return (
    <article className="idea-guide" aria-labelledby="idea-guide-title">
      <header><span className="meta">YAŞAYAN FİKİR BELGESİ · TASLAK DEĞİŞİKLİKLER CANONICAL PLANI ETKİLEMEZ</span><h2 id="idea-guide-title">{guide.title}</h2><p>{guide.improvedIdea}</p></header>
      <div className="idea-guide-facts"><section><h3>Kim için?</h3><p>{guide.targetUser}</p></section><section><h3>Hangi problem?</h3><p>{guide.problem}</p></section></div>
      <div className="idea-guide-grid">{list('İlk sürümde', guide.mvp)}{list('Şimdilik dışında', guide.outOfScope)}{list('Riskler', guide.risks)}{list('Sıradaki adımlar', guide.nextSteps)}</div>
      {project.ideaLabSession?.conceptSummary && <ConceptAgreementEditor project={project} onCommit={onCommit}/>}
      <IdeaDocumentHistoryPanel project={project} onCommit={onCommit}/>
      <section className="idea-conversion" aria-labelledby="idea-conversion-title">
        <div>
          <span className="meta">FİKİRDEN PLANA GEÇİŞ</span>
          <h3 id="idea-conversion-title">{conversion.alreadyConverted ? 'Canonical plan oluşturuldu' : 'Nelerin plana dönüşeceğini önce gör'}</h3>
          <p>{conversion.alreadyConverted
            ? 'Fikir belgesinin onaylanan sürümü yaşayan plana işlendi. Sonraki fikir değişiklikleri etki analiziyle ele alınır.'
            : 'Bu işlem yalnız açık onaydan sonra hedefi, kapsamı ve düzenlenebilir gereksinim taslaklarını canonical plana ekler.'}</p>
        </div>
        {conversion.alreadyConverted
          ? <button type="button" className="primary" onClick={onOpenPlan}><Check size={16}/> Planı aç</button>
          : <button type="button" className="primary" disabled={!conversion.canConvert} onClick={() => setConversionPreview(conversion)}>
              <Eye size={16}/> Dönüşümü önizle
            </button>}
        {!conversion.alreadyConverted && conversion.blockers.length > 0 && <div className="idea-conversion-blockers" role="status">
          <CircleAlert size={16}/><span><b>Dönüşüm için {conversion.blockers.length} konu tamamlanmalı</b><small>{conversion.blockers[0]}</small></span>
        </div>}
        {conversionPreview && <div className="idea-conversion-preview" role="region" aria-label="Plan dönüşümü önizlemesi">
          <header><div><span className="meta">ONAY ÖNCESİ ÖNİZLEME</span><h3>Canonical r{conversionPreview.baseCanonicalRevision + 1} oluşturulacak</h3></div><button type="button" onClick={() => setConversionPreview(null)}><RotateCcw size={14}/> Kapat</button></header>
          <dl>
            <div><dt>Hedef</dt><dd>{conversionPreview.objectiveCount}</dd></div>
            <div><dt>Gereksinim taslağı</dt><dd>{conversionPreview.requirementTitles.length}</dd></div>
            <div><dt>Kabul edilmiş karar</dt><dd>{conversionPreview.acceptedDecisions}</dd></div>
            <div><dt>Risk</dt><dd>{conversionPreview.risks}</dd></div>
          </dl>
          <p><b>Ana hedef:</b> {conversionPreview.objective}</p>
          <p><b>Etkilenen bölümler:</b> {conversionPreview.affectedSections.join(', ')}</p>
          <ul>{conversionPreview.requirementTitles.map(title => <li key={title}>{title} — kullanıcı onayı bekleyen gereksinim taslağı</li>)}</ul>
          <footer><span>Bu onay canonical revision’ı artırır. İşlem başarısız olursa hiçbir kısmi değişiklik kaydedilmez.</span><button type="button" className="primary" disabled={converting} onClick={convert}><Check size={16}/> {converting ? 'Dönüştürülüyor…' : 'Onayla ve plana dönüştür'}</button></footer>
        </div>}
      </section>
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
