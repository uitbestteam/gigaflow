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
import { ExerciseLibraryPage } from './features/exercises/ExerciseLibraryPage';
import { PlansPage } from './features/plans/PlansPage';
import { PlanBuilderPage } from './features/plans/PlanBuilderPage';
import { GeneratePlanPage } from './features/ai/GeneratePlanPage';
import { MealPlannerPage } from './features/meal/MealPlannerPage';
import { InbodyPage } from './features/inbody/InbodyPage';
import { StatsPage } from './features/stats/StatsPage';

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
              <Route path={ROUTES.exercises} element={<ExerciseLibraryPage />} />
              <Route path={ROUTES.plans} element={<PlansPage />} />
              <Route path={ROUTES.planNew} element={<PlanBuilderPage />} />
              <Route path={ROUTES.planEdit} element={<PlanBuilderPage />} />
              <Route path={ROUTES.generate} element={<GeneratePlanPage />} />
              <Route path={ROUTES.meal} element={<MealPlannerPage />} />
              <Route path={ROUTES.inbody} element={<InbodyPage />} />
              <Route path={ROUTES.stats} element={<StatsPage />} />
            </Routes>
          </MainLayout>
        </AuthGate>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
