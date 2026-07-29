import type { Task } from '../../v4/contracts.js';

export function TaskContractSummary({ tasks }: { tasks: Task[] }) {
  if (!tasks.length) return null;
  return (
    <div className="task-compilation" role="region" aria-label="Onaylı görev sözleşmeleri">
      <b>{tasks.length} onaylı TaskContract V2</b>
      {tasks.map(task => (
        <details key={task.id}>
          <summary>{task.title}</summary>
          <p><b>Amaç:</b> {task.contract.objective}</p>
          <p><b>Dosya politikası:</b> {task.contract.filePolicy.status === 'confirmed' ? 'Onaylı' : 'Envanter/onay gerekli'}</p>
          <p><b>İzinli yollar:</b> {task.contract.filePolicy.allowedPaths.join(', ') || 'Henüz belirlenmedi'}</p>
          <p><b>Yasak yollar:</b> {task.contract.filePolicy.forbiddenPaths.join(', ')}</p>
          <p><b>Doğrulama:</b> {task.contract.verification.commands.join(', ') || 'Komut keşfi gerekli'} · {task.contract.verification.testCaseIds.join(', ')}</p>
          <p><b>Geri alma:</b> {task.contract.rollbackPlan}</p>
        </details>
      ))}
    </div>
  );
}
