import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const packageVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;
let commitSha = process.env.GITHUB_SHA || 'development';
try {
  if (commitSha === 'development') commitSha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
} catch {
  // Source archives may not include Git metadata.
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageVersion),
    __COMMIT_SHA__: JSON.stringify(commitSha)
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'PromtGen · Yaşayan Proje Mimarı', short_name: 'PromtGen',
        description: 'Local-first AI destekli proje planlama çalışma alanı',
        theme_color: '#f7f7f5', background_color: '#f7f7f5', display: 'standalone',
        icons: [{ src: '/pwa-192.svg', sizes: '192x192', type: 'image/svg+xml' }, { src: '/pwa-512.svg', sizes: '512x512', type: 'image/svg+xml' }]
      }
    })
  ],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const moduleId = id.replaceAll('\\', '/');
          if (!moduleId.includes('node_modules')) {
            if (moduleId.includes('/src/react/components/IdeExportDialog.')) return 'export-tools';
            if (moduleId.includes('/src/react/components/RevisionHistoryDialog.') || moduleId.includes('/src/react/components/DecisionTimelineModal.')) return 'revision-tools';
            if (moduleId.includes('/src/react/components/RuntimeHealthDialog.')) return 'execution-tools';
            if ([
              'IdeaAmplifierPanel.', 'IdeaLabComponents.', 'ChangeImpactPanel.', 'ResearchPanel.',
              'ReviewPanel.', 'ModulePanel.', 'StorageHealthPanel.', 'TraceabilityMap.', 'PlanningScenarioPanel.', 'SectionRegenerationPanel.', 'ArchitectureComparatorModal.',
              'ProjectInventoryModal.', 'AgentCommitteeModal.', 'FinalizePlanDialog.'
            ].some(name => moduleId.includes(`/src/react/components/${name}`))) return 'planning-tools';
            return undefined;
          }
          if (id.includes('jszip')) return 'archive';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
          if (id.includes('zod')) return 'schema';
          if (id.includes('@tauri-apps')) return 'tauri';
          return 'vendor';
        }
      }
    }
  }
});
