import { useState } from 'react';
import type { ProjectDocumentV5 } from '../../v4/contracts.js';
import {
  analyzePlanCodeAlignment,
  createPlanCodeAlignmentSuggestion,
  type AlignmentResolutionAction,
  type AlignmentStatus
} from '../../v4/application/plan-code-alignment.js';

const STATUS_LABELS: Record<AlignmentStatus, string> = {
  not_analyzed: 'Envanter gerekli',
  scope_missing: 'Kapsam eksik',
  evidence_gap: 'Kanıt açığı',
  partially_evidenced: 'Kısmi kanıt',
  aligned: 'Uyumlu',
  suspicious: 'Şüpheli',
  out_of_scope: 'Kapsam dışı'
};

const ACTION_LABELS: Record<AlignmentResolutionAction, string> = {
  update_plan: 'Plan değişikliği öner',
  accept_deviation: 'Sapmayı karar olarak incele',
  rollback_guidance: 'Geri alma rehberi oluştur'
};

type Commit = (project: ProjectDocumentV5, message?: string, commandType?: string) => void | Promise<void>;

export function PlanCodeAlignmentPanel({ project, onCommit }: { project: ProjectDocumentV5; onCommit: Commit }) {
  const report = analyzePlanCodeAlignment(project);
  const [feedback, setFeedback] = useState('');

  const propose = async (taskId: string, action: AlignmentResolutionAction) => {
    const result = createPlanCodeAlignmentSuggestion(project, taskId, action);
    setFeedback(result.reason);
    if (result.created) {
      await onCommit(result.project, result.reason, 'CreatePlanCodeAlignmentSuggestion');
    }
  };

  return (
    <details className="plan-code-alignment">
      <summary>
        <span><b>Plan–kod uyumluluk kontrolü</b><small>V2 · tavsiye sistemi · {report.summary.alignedTasks}/{report.summary.tasks} görev uyumlu</small></span>
        <strong>{report.summary.evidenceGaps > 0 ? `${report.summary.evidenceGaps} açık` : 'Uyumlu'}</strong>
      </summary>
      <div className="alignment-body">
        <p className="alignment-boundary">PromtGen burada kod yazmaz veya dosya değiştirmez. Planı güvenli dosya envanteri ve kullanıcıca sağlanan teslim kanıtlarıyla karşılaştırır; çözüm seçeneklerini ayrıca onaylanacak öneri olarak hazırlar.</p>
        {report.summary.inventoryFiles === 0 && <div className="alignment-empty"><span><b>Mevcut proje envanteri bulunamadı.</b><small>Yeni proje ekranında isteğe bağlı klasör seçerek güvenli, yerel envanter oluşturabilirsin.</small></span></div>}
        <p className="alignment-summary">
          {report.summary.requirements} gereksinim · {report.summary.tasks} görev · {report.summary.inventoryFiles} güvenli dosya · {report.summary.filteredInventoryFiles} filtrelenen dosya · {report.summary.evidenceGaps} inceleme açığı
        </p>
        {feedback && <p className="alignment-feedback" role="status">{feedback}</p>}
        {report.tasks.map(task => (
          <details className={`alignment-task status-${task.status}`} key={task.taskId}>
            <summary><span><b>{task.title}</b><small>{task.requirementIds.length} gereksinim · {task.linkedTestCaseIds.length} test · {task.matchedPaths.length} envanter eşleşmesi · {task.changedPaths.length} bildirilen değişiklik</small></span><em>{STATUS_LABELS[task.status]}</em></summary>
            <div>
              {task.matchedPaths.length > 0 && <p><b>Kapsam eşleşmeleri:</b> {task.matchedPaths.slice(0, 8).join(', ')}</p>}
              {task.changedPaths.length > 0 && <p><b>Teslimde bildirilen dosyalar:</b> {task.changedPaths.slice(0, 8).join(', ')}</p>}
              {task.outOfScopePaths.length > 0 && <p className="alignment-warning"><b>Kapsam dışı/yasaklı:</b> {task.outOfScopePaths.join(', ')}</p>}
              {task.verificationCommands.length > 0 && <p><b>Doğrulama komutları:</b> {task.verificationCommands.join(', ')}</p>}
              {task.findings.length > 0 ? <ul>{task.findings.map(finding => <li key={finding}>{finding}</li>)}</ul> : <p>Dosya kapsamı, test bağlantısı ve doğrulama komutu mevcut.</p>}
              {task.status !== 'aligned' && <div className="alignment-actions" aria-label={`${task.title} hizalama seçenekleri`}>
                {(Object.keys(ACTION_LABELS) as AlignmentResolutionAction[]).map(action => (
                  <button
                    key={action}
                    type="button"
                    className={task.recommendedAction === action ? 'primary' : undefined}
                    onClick={() => propose(task.taskId, action)}
                  >
                    {ACTION_LABELS[action]}{task.recommendedAction === action ? ' · Önerilen' : ''}
                  </button>
                ))}
              </div>}
            </div>
          </details>
        ))}
        <small className="alignment-note">{report.limitations[1]} {report.limitations[3]}</small>
      </div>
    </details>
  );
}
