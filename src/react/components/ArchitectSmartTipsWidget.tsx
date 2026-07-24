import { Lightbulb, ArrowRight } from 'lucide-react';

export function ArchitectSmartTipsWidget({ project }: { project: any }) {
  const readiness = project.readiness?.score || 0;
  const phase = project.lifecycle?.activePhase || 'DISCOVERY';
  const hasTasks = (project.tasks || []).length > 0;
  const hasDecisions = (project.decisions || []).filter((d: any) => d.status === 'accepted').length > 0;

  let tipTitle = 'Fikir Şekillendirme Aşaması';
  let tipBody = 'Projenizin temel amacını ve hedef kullanıcı profilini netleştirmek için AI mimarımıza fikir veya kısıt yazın.';
  let actionText = 'Fikri Derinleştir';

  if (readiness >= 80) {
    tipTitle = '🎯 Plan Canlıya Almaya Hazır!';
    tipBody = 'Hazırlık skorunuz %80 üzerine çıktı. IDE Çalışma Paketini (.cursorrules / CLAUDE.md) dışa aktararak kodlamaya başlayabilirsiniz.';
    actionText = 'IDE Paketini İndir';
  } else if (hasTasks) {
    tipTitle = '📋 Görev ve Kabul Testleri Hazır';
    tipBody = 'Ajan promt adımlarını inceleyebilir, görev bağımlılıklarını şemadan kontrol edebilirsiniz.';
    actionText = 'Görevleri İncele';
  } else if (hasDecisions) {
    tipTitle = '⚙️ Mimari Kararlar Şekilleniyor';
    tipBody = 'Kabul ettiğiniz kararlar doğrultusunda "Gereksinimlerden görev taslağı üret" butonuna basarak görev listesi çıkarabilirsiniz.';
    actionText = 'Görev Taslağı Üret';
  }

  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '10px', padding: '12px 14px', margin: '10px 0', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
      <div style={{ background: 'rgba(139, 92, 246, 0.3)', padding: '6px', borderRadius: '6px', color: '#a78bfa', marginTop: '2px' }}>
        <Lightbulb size={18} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '10px', color: '#a78bfa', fontWeight: 700, letterSpacing: '0.5px' }}>AKILLI MİMAR İPUCU (NEXT BEST ACTION)</div>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', margin: '2px 0' }}>{tipTitle}</div>
        <div style={{ fontSize: '11px', color: '#d1d5db', lineHeight: '1.4' }}>{tipBody}</div>
      </div>
    </div>
  );
}
