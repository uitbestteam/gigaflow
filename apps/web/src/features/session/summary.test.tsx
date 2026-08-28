import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, type Mock } from 'vitest';
import { EquipmentType, MuscleGroup, SessionStatus } from '@gigaflow/shared';
import type { Exercise, PersonalRecord, SetLog, TrainingSession } from '@gigaflow/shared';
import { SummaryPage } from './SummaryPage';
import { ROUTES } from '../../routes';
import * as api from '../../lib/api';

vi.mock('../../lib/api', () => ({
  getPrs: vi.fn(),
  getExercises: vi.fn(),
}));

function makeSession(): TrainingSession {
  return {
    id: 's1',
    userId: 'user-1',
    templateId: 'tmpl-1',
    sessionNumber: 3,
    startedAt: new Date('2026-01-01T00:00:00Z'),
    finishedAt: new Date('2026-01-01T00:32:05Z'),
    status: SessionStatus.COMPLETED,
    totalVolume: 1234,
    totalSets: 4,
    durationSeconds: 125,
  };
}

function makeSetLogs(): SetLog[] {
  const base = {
    id: 'log',
    sessionId: 's1',
    setNumber: 1,
    weightSuggested: 0,
    repsSuggested: 0,
    isCompleted: true,
    loggedAt: new Date('2026-01-01T00:10:00Z'),
  };
  return [
    { ...base, id: 'log-1', slotId: 'slot-a', exerciseId: 'ex-a', weightKg: 80, repsDone: 8 },
    { ...base, id: 'log-2', slotId: 'slot-a', exerciseId: 'ex-a', setNumber: 2, weightKg: 82, repsDone: 8 },
    { ...base, id: 'log-3', slotId: 'slot-b', exerciseId: 'ex-b', weightKg: 40, repsDone: 10 },
  ];
}

function makeExercises(): Exercise[] {
  return [
    {
      id: 'ex-a',
      slug: 'bench-press',
      name: { en: 'Bench Press', vi: 'Đẩy ngực' },
      muscleGroup: MuscleGroup.CHEST,
      equipmentType: EquipmentType.BARBELL,
      defaultIncrement: 2.5,
      isCustom: false,
    },
    {
      id: 'ex-b',
      slug: 'lat-pulldown',
      name: { en: 'Lat Pulldown', vi: 'Kéo xô' },
      muscleGroup: MuscleGroup.BACK,
      equipmentType: EquipmentType.MACHINE,
      defaultIncrement: 2.5,
      isCustom: false,
    },
  ];
}

function makePrs(): PersonalRecord[] {
  return [
    {
      exerciseId: 'ex-a',
      name: { en: 'Bench Press', vi: 'Đẩy ngực' },
      bestSet: { weightKg: 82, repsDone: 8, e1RM: 100 },
    },
  ];
}

function renderSummary(session: TrainingSession | undefined, setLogs: SetLog[] | undefined) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (session) {
    queryClient.setQueryData(['session', 's1'], session);
  }
  if (setLogs) {
    queryClient.setQueryData(['session', 's1', 'sets'], setLogs);
  }
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/session/s1/summary']}>
        <Routes>
          <Route path={ROUTES.sessionSummary} element={<SummaryPage />} />
          <Route path={ROUTES.home} element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SummaryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.getExercises as unknown as Mock).mockResolvedValue(makeExercises());
    (api.getPrs as unknown as Mock).mockResolvedValue(makePrs());
  });

  it('renders duration and total volume from the finished session', async () => {
    renderSummary(makeSession(), makeSetLogs());

    expect(await screen.findByText('02:05')).toBeInTheDocument();
    expect(screen.getByText('1234')).toBeInTheDocument();
  });

  it('renders the completed-session header with the session number', async () => {
    renderSummary(makeSession(), makeSetLogs());

    expect(await screen.findByText('✓ Session #3 complete')).toBeInTheDocument();
  });

  it('rounds a group average with a repeating decimal to 1 decimal place', async () => {
    const base = {
      id: 'log',
      sessionId: 's1',
      slotId: 'slot-a',
      exerciseId: 'ex-a',
      weightSuggested: 0,
      repsSuggested: 0,
      repsDone: 8,
      isCompleted: true,
      loggedAt: new Date('2026-01-01T00:10:00Z'),
    };
    // (10 + 10 + 11) / 3 = 10.333... which should round to 10.3.
    const setLogs: SetLog[] = [
      { ...base, id: 'log-1', setNumber: 1, weightKg: 10 },
      { ...base, id: 'log-2', setNumber: 2, weightKg: 10 },
      { ...base, id: 'log-3', setNumber: 3, weightKg: 11 },
    ];
    renderSummary(makeSession(), setLogs);

    expect(await screen.findByText('3 sets · avg 10.3kg')).toBeInTheDocument();
  });

  it('renders a SummaryRow per exercise with the PR badge only for the PR exercise', async () => {
    renderSummary(makeSession(), makeSetLogs());

    const benchRow = await screen.findByText('Bench Press');
    const latRow = await screen.findByText('Lat Pulldown');

    const benchContainer = benchRow.closest('div')?.parentElement;
    const latContainer = latRow.closest('div')?.parentElement;

    expect(benchContainer?.textContent).toContain('PR');
    expect(latContainer?.textContent).not.toContain('PR');
  });

  it('"Back to home" navigates to /', async () => {
    const user = userEvent.setup();
    renderSummary(makeSession(), makeSetLogs());

    await user.click(await screen.findByRole('button', { name: /back to home/i }));

    expect(await screen.findByText('Home Page')).toBeInTheDocument();
  });

  it('redirects to Home when the finished session is missing from the cache', () => {
    renderSummary(undefined, undefined);

    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });

  it('renders just the header (no rows) when the sets cache entry is missing', async () => {
    renderSummary(makeSession(), undefined);

    expect(await screen.findByText('02:05')).toBeInTheDocument();
    expect(screen.queryByText('Bench Press')).not.toBeInTheDocument();
  });
});
