import { styled } from "@linaria/react";
import { useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { Sidebar } from "./components/Sidebar";
import { ConnectionPage } from "./features/connection/ConnectionPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { OverlaySettingsPage } from "./features/overlays/OverlaySettingsPage";
import { FeaturePage } from "./features/shared/FeaturePage";
import { VoiceStudioPage } from "./features/voices/VoiceStudioPage";
import { GlobalStyles } from "./styles/GlobalStyles";
import type { AppView } from "./types/navigation";

const AppFrame = styled.div`
  display: flex;
  width: 100%;
  min-height: 100vh;
`;

const Main = styled.main`
  min-width: 0;
  height: 100vh;
  flex: 1;
  overflow: auto;
`;

export default function App() {
  const [activeView, setActiveView] = useState<AppView>("dashboard");

  return (
    <GlobalStyles>
      <AppFrame>
        <Sidebar activeView={activeView} onNavigate={setActiveView} />
        <Main>
          <AppHeader activeView={activeView} />
          {activeView === "dashboard" && <DashboardPage />}
          {activeView === "rules" && (
            <FeaturePage view="rules" />
          )}
          {activeView === "voices" && <VoiceStudioPage />}
          {activeView === "overlays" && <OverlaySettingsPage />}
          {activeView === "connection" && (
            <ConnectionPage onNavigateDashboard={() => setActiveView("dashboard")} />
          )}
        </Main>
      </AppFrame>
    </GlobalStyles>
  );
}
