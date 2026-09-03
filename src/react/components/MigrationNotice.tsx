import { AlertTriangle } from 'lucide-react';
import type { ProjectDocumentV5 } from '../../v4/contracts.js';
import { migrationReviewNotices } from '../../v4/application/workspace-stages.js';

/**
 * Eski modelde ilerlemiş bir proje V3'e geçince fikir aşamasına düşer —
 * sistem kullanıcı adına onay uydurmaz. Ama boş bir projeyle aynı görünmemeli:
 * migration notları burada "gözden geçir" çağrısıyla görünür. Proje fikri
 * onaylanıp aşama ilerleyince not kendiliğinden kaybolur.
 */
export function MigrationNotice({ project }: { project: ProjectDocumentV5 }) {
  const notices = migrationReviewNotices(project);
  if (notices.length === 0) return null;

  return <section className="plan-alignment-notice review" role="status" aria-labelledby="migration-notice-title">
    <AlertTriangle size={20}/>
    <div style={{ gridColumn: '2 / -1' }}>
      <span className="meta">GEÇİŞ NOTU · GÖZDEN GEÇİR</span>
      <h2 id="migration-notice-title">Bu proje eski modelde ilerlemişti</h2>
      {notices.map(note => <p key={note}>{note}</p>)}
    </div>
  </section>;
}
