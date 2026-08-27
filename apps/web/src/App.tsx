import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthGate } from './features/auth/AuthGate';
import { UpgradePrompt } from './features/auth/UpgradePrompt';
import { MainLayout } from './components/MainLayout';
import { ROUTES } from './routes';
import { HomePage } from './features/home/HomePage';
import { ActiveSessionPage } from './features/session/ActiveSessionPage';
import { SummaryPage } from './features/session/SummaryPage';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthGate>
          <MainLayout>
            <Routes>
              <Route path={ROUTES.home} element={<HomePage />} />
              <Route path={ROUTES.session} element={<ActiveSessionPage />} />
              <Route path={ROUTES.sessionSummary} element={<SummaryPage />} />
              <Route path={ROUTES.account} element={<UpgradePrompt />} />
            </Routes>
          </MainLayout>
        </AuthGate>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
