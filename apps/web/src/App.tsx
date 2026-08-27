import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthGate } from './features/auth/AuthGate';
import { UpgradePrompt } from './features/auth/UpgradePrompt';
import { MainLayout } from './components/MainLayout';
import { ROUTES } from './routes';
import { HomePage } from './features/home/HomePage';
import { ActiveSessionPage } from './features/session/ActiveSessionPage';

// Placeholder route element — the real SummaryPage lands in F1 task 10.
// Kept minimal on purpose.
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
              <Route path={ROUTES.session} element={<ActiveSessionPage />} />
              <Route path={ROUTES.sessionSummary} element={<SessionSummaryPlaceholder />} />
              <Route path={ROUTES.account} element={<UpgradePrompt />} />
            </Routes>
          </MainLayout>
        </AuthGate>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
