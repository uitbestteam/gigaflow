import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthGate } from './features/auth/AuthGate';
import { UpgradePrompt } from './features/auth/UpgradePrompt';
import { MainLayout } from './components/MainLayout';
import { ROUTES } from './routes';
import { HomePage } from './features/home/HomePage';

// Placeholder route elements — the real ActiveSessionPage / SummaryPage
// land in F1 tasks 9–10. Kept minimal on purpose.
function ActiveSessionPlaceholder() {
  return <div>Active session</div>;
}

function SessionSummaryPlaceholder() {
  return <div>Session summary</div>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthGate>
          <MainLayout>
            <Routes>
              <Route path={ROUTES.home} element={<HomePage />} />
              <Route path={ROUTES.session} element={<ActiveSessionPlaceholder />} />
              <Route path={ROUTES.sessionSummary} element={<SessionSummaryPlaceholder />} />
              <Route path={ROUTES.account} element={<UpgradePrompt />} />
            </Routes>
          </MainLayout>
        </AuthGate>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
