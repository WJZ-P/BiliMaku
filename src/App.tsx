import { styled } from "@linaria/react";
import { useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { Sidebar } from "./components/Sidebar";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { FeaturePage } from "./features/shared/FeaturePage";
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
          {activeView === "dashboard" ? (
            <DashboardPage />
          ) : (
            <FeaturePage
              view={activeView}
              onNavigateDashboard={() => setActiveView("dashboard")}
            />
          )}
        </Main>
      </AppFrame>
    </GlobalStyles>
  );
}
