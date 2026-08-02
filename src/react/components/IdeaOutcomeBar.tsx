import { useEffect, useMemo, useState } from 'react';
import { Check, CircleAlert, Download, Eye, RotateCcw } from 'lucide-react';
import type { ProjectDocumentV5 } from '../../v4/contracts.js';
import {
  buildIdeaGuide,
  ideaGuideToMarkdown
} from '../../v4/application/idea-guide-service.js';
import {
  previewIdeaPlanConversion,
  type IdeaPlanConversionPreview
} from '../../v4/application/idea-plan-conversion-service.js';
import { ConceptAgreementEditor } from './ConceptAgreementEditor.js';
import { IdeaDocumentHistoryPanel } from './IdeaDocumentHistoryPanel.js';

const downloadText = (content: string, filename: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export function IdeaGuidePanel({ project, onCommit, onConvert, onOpenPlan }: {
  project: ProjectDocumentV5;
  onCommit: (project: ProjectDocumentV5, message?: string, commandType?: string) => void;
  onConvert: (preview: IdeaPlanConversionPreview) => Promise<boolean>;
  onOpenPlan: () => void;
}) {
  const guide = useMemo(() => buildIdeaGuide(project), [project]);
  const conversion = useMemo(() => previewIdeaPlanConversion(project), [project]);
  const [conversionPreview, setConversionPreview] = useState<IdeaPlanConversionPreview | null>(null);
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
      <header><span className="meta">FİKİR ÖZETİ · ONAY BEKLİYOR</span><h2 id="idea-guide-title">{guide.title}</h2><p>{guide.improvedIdea}</p><small>Konuşmadan çıkardığımız ortak anlayış. Yanlış veya eksik yerleri düzelt; onaylamadan plana geçmez.</small></header>
      <div className="idea-guide-facts"><section><h3>Kim için?</h3><p>{guide.targetUser}</p></section><section><h3>Hangi problem?</h3><p>{guide.problem}</p></section></div>
      <div className="idea-guide-grid">{list('İlk sürümde', guide.mvp)}{list('Şimdilik dışında', guide.outOfScope)}{list('Riskler', guide.risks)}{list('Sıradaki adımlar', guide.nextSteps)}</div>
      {project.ideaLabSession?.conceptSummary && <ConceptAgreementEditor project={project} onCommit={onCommit}/>}
      <IdeaDocumentHistoryPanel project={project} onCommit={onCommit}/>
      <section className="idea-conversion" aria-labelledby="idea-conversion-title">
        <div>
          <span className="meta">FİKİRDEN PLANA GEÇİŞ</span>
          <h3 id="idea-conversion-title">{conversion.alreadyConverted ? 'Plan sürümü oluşturuldu' : 'Nelerin plana dönüşeceğini önce gör'}</h3>
          <p>{conversion.alreadyConverted
            ? 'Fikir belgesinin onaylanan sürümü yaşayan plana işlendi. Sonraki fikir değişiklikleri etki analiziyle ele alınır.'
            : 'Bu işlem yalnız açık onayından sonra hedefi, kapsamı ve düzenlenebilir gereksinim taslaklarını plana ekler.'}</p>
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
          <header><div><span className="meta">ONAY ÖNCESİ ÖNİZLEME</span><h3>Yeni bir plan sürümü oluşturulacak</h3></div><button type="button" onClick={() => setConversionPreview(null)}><RotateCcw size={14}/> Kapat</button></header>
          <dl>
            <div><dt>Hedef</dt><dd>{conversionPreview.objectiveCount}</dd></div>
            <div><dt>Gereksinim taslağı</dt><dd>{conversionPreview.requirementTitles.length}</dd></div>
            <div><dt>Kabul edilmiş karar</dt><dd>{conversionPreview.acceptedDecisions}</dd></div>
            <div><dt>Risk</dt><dd>{conversionPreview.risks}</dd></div>
          </dl>
          <p><b>Ana hedef:</b> {conversionPreview.objective}</p>
          <p><b>Etkilenen bölümler:</b> {conversionPreview.affectedSections.join(', ')}</p>
          <ul>{conversionPreview.requirementTitles.map(title => <li key={title}>{title} — kullanıcı onayı bekleyen gereksinim taslağı</li>)}</ul>
          <footer><span>Önceki sürüm korunur. İşlem başarısız olursa hiçbir kısmi değişiklik kaydedilmez.</span><button type="button" className="primary" disabled={converting} onClick={convert}><Check size={16}/> {converting ? 'Dönüştürülüyor…' : 'Onayla ve plana dönüştür'}</button></footer>
        </div>}
      </section>
      <div className="idea-guide-actions">
        <button className="primary" type="button" onClick={() => downloadText(ideaGuideToMarkdown(guide), `${project.identity.name}-fikir-ozeti.md`, 'text/markdown')}>
          <Download size={16}/> Fikir özetini indir
        </button>
      </div>
    </article>
  );
}
