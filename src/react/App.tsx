import { lazy, useRef, useState } from 'react';
import { CircleAlert, Sparkles } from 'lucide-react';
import { StartScreen } from './components/StartScreen.js';
import { LazyFeatureBoundary } from './components/LazyFeatureBoundary.js';
import { useProjectState } from './hooks/useProjectState.js';
import { Workspace } from './Workspace.js';

const ProviderSettingsDialog = lazy(() => import('./components/ProviderSettingsDialog.js').then(module => ({ default: module.ProviderSettingsDialog })));

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsTriggerRef = useRef<HTMLElement | null>(null);
  const {
    projects,
    setActiveId,
    activeProject,
    loading,
    appError,
    providerSettings,
    setProviderSettings,
    persist,
    create,
    importPackage,
    credentialVault
  } = useProjectState();

  if (loading) {
    return <div className="loading"><Sparkles /> PromtGen hazırlanıyor…</div>;
  }

  const openSettings = () => {
    settingsTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSettingsOpen(true);
  };
  const closeSettings = () => {
    setSettingsOpen(false);
    requestAnimationFrame(() => settingsTriggerRef.current?.focus());
  };

  if (!activeProject) {
    return (
      <>
        <StartScreen
          onCreate={create}
          onImport={importPackage}
          projects={projects}
          onOpen={setActiveId}
          providerSettings={providerSettings}
          onProviderSettings={setProviderSettings}
          onOpenSettings={openSettings}
        />
        {settingsOpen && <LazyFeatureBoundary label="AI sağlayıcı ayarları" resetKey={settingsOpen}>
          <ProviderSettingsDialog
            open
            settings={providerSettings}
            onSave={setProviderSettings}
            onClose={closeSettings}
            credentialVault={credentialVault}
          />
        </LazyFeatureBoundary>}
        {appError && <div className="toast error" role="alert"><CircleAlert size={17} />{appError}</div>}
      </>
    );
  }

  return (
    <Workspace
      project={activeProject}
      projects={projects}
      onProject={setActiveId}
      onNew={() => setActiveId(null)}
      onPersist={persist}
      providerSettings={providerSettings}
      onProviderSettings={setProviderSettings}
      credentialVault={credentialVault}
    />
  );
}
