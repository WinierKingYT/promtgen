import { Activity, ShieldCheck, Layers, FileCheck, Rocket } from 'lucide-react';

export function ProjectHealthRadarCard({ project }: { project: any }) {
  const readiness = project.readiness || { score: 0, blockers: [], warnings: [] };
  const hasArch = !!project.sections?.architecture?.content || !!project.sections?.architecture?.items?.length;
  const hasSecurity = !!project.sections?.security?.content || !!project.sections?.security?.items?.length;
  const hasTesting = !!project.testCases?.length || !!project.sections?.testing?.content;

  const archScore = hasArch ? 85 : 30;
  const securityScore = hasSecurity ? 90 : 25;
  const testingScore = hasTesting ? 80 : 20;
  const overallScore = readiness.score;

  return (
    <div style={{ background: 'rgba(24, 24, 27, 0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '14px', margin: '12px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Activity size={14} /> PROJE SAĞLIK RADARI
        </span>
        <span style={{ fontSize: '11px', color: overallScore >= 80 ? '#10b981' : '#f59e0b', fontWeight: 700 }}>
          Genel: %{overallScore}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '11px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d1d5db', marginBottom: '2px' }}>
            <span><Layers size={11} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Mimari Netlik</span>
            <b>%{archScore}</b>
          </div>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${archScore}%`, height: '100%', background: '#3b82f6' }} />
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d1d5db', marginBottom: '2px' }}>
            <span><ShieldCheck size={11} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Güvenlik Kapsamı</span>
            <b>%{securityScore}</b>
          </div>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${securityScore}%`, height: '100%', background: '#10b981' }} />
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d1d5db', marginBottom: '2px' }}>
            <span><FileCheck size={11} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Test Kapsamı</span>
            <b>%{testingScore}</b>
          </div>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${testingScore}%`, height: '100%', background: '#a78bfa' }} />
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d1d5db', marginBottom: '2px' }}>
            <span><Rocket size={11} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Canlıya Alma</span>
            <b>%{overallScore}</b>
          </div>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${overallScore}%`, height: '100%', background: '#f59e0b' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
