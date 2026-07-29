import type { ProjectDocumentV5 } from '../../v4/contracts.js';
import { analyzePlanCodeAlignment, type AlignmentStatus } from '../../v4/application/plan-code-alignment.js';

const STATUS_LABELS: Record<AlignmentStatus, string> = {
  not_analyzed: 'Envanter gerekli',
  scope_missing: 'Kapsam eksik',
  evidence_gap: 'Kanıt açığı',
  partially_evidenced: 'Kısmi kanıt',
  evidenced: 'Kanıtlı kapsam'
};

export function PlanCodeAlignmentPanel({ project }: { project: ProjectDocumentV5 }) {
  const report = analyzePlanCodeAlignment(project);
  return (
    <details className="plan-code-alignment">
      <summary>
        <span><b>Plan–kod uyumluluk kontrolü</b><small>Salt okunur · {report.summary.evidencedTasks}/{report.summary.tasks} görev kanıtlı</small></span>
        <strong>{report.summary.evidenceGaps > 0 ? `${report.summary.evidenceGaps} açık` : 'Uyumlu'}</strong>
      </summary>
      <div className="alignment-body">
        <p className="alignment-boundary">PromtGen burada kod yazmaz veya dosya değiştirmez. Yalnız canonical planı yerel dosya envanteri ve test bağlantılarıyla karşılaştırır.</p>
        {report.summary.inventoryFiles === 0 && <div className="alignment-empty"><span><b>Mevcut proje envanteri bulunamadı.</b><small>Yeni proje ekranında isteğe bağlı klasör seçerek güvenli, yerel envanter oluşturabilirsin.</small></span></div>}
        <p className="alignment-summary">{report.summary.requirements} gereksinim · {report.summary.tasks} görev · {report.summary.inventoryFiles} dosya · {report.summary.evidenceGaps} kanıt açığı</p>
        {report.tasks.map(task => (
          <details className={`alignment-task status-${task.status}`} key={task.taskId}>
            <summary><span><b>{task.title}</b><small>{task.requirementIds.length} gereksinim · {task.linkedTestCaseIds.length} test · {task.matchedPaths.length} dosya eşleşmesi · {task.evidencePackageIds.length} onaylı kanıt</small></span><em>{STATUS_LABELS[task.status]}</em></summary>
            <div>
              {task.matchedPaths.length > 0 && <p><b>Kapsam eşleşmeleri:</b> {task.matchedPaths.slice(0, 8).join(', ')}</p>}
              {task.verificationCommands.length > 0 && <p><b>Doğrulama komutları:</b> {task.verificationCommands.join(', ')}</p>}
              {task.findings.length > 0 ? <ul>{task.findings.map(finding => <li key={finding}>{finding}</li>)}</ul> : <p>Dosya kapsamı, test bağlantısı ve doğrulama komutu mevcut.</p>}
            </div>
          </details>
        ))}
        <small className="alignment-note">{report.limitations[1]}</small>
      </div>
    </details>
  );
}
