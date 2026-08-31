import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, type Mock } from 'vitest';
import { AwardKey, EquipmentType, MuscleGroup } from '@gigaflow/shared';
import type { Award, Exercise, PersonalRecord, StatsSummary, WeightLog } from '@gigaflow/shared';
import { StatsPage } from './StatsPage';

vi.mock('../../lib/api', () => ({
  getStatsSummary: vi.fn(),
  getAwards: vi.fn(),
  getPrs: vi.fn(),
  getExercises: vi.fn(),
  getWeightHistory: vi.fn(),
  logWeight: vi.fn(),
}));

import * as api from '../../lib/api';

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/stats']}>
        <StatsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function makeSummary(overrides: Partial<StatsSummary> = {}): StatsSummary {
  return {
    totalSessions: 12,
    totalVolume: 34500,
    totalPrs: 5,
    totalExercises: 8,
    ...overrides,
  };
}

function makeAward(overrides: Partial<Award> = {}): Award {
  return {
    key: AwardKey.FIRST_WORKOUT,
    name: { en: 'First Workout', vi: 'Buổi tập đầu tiên' },
    description: { en: 'Complete your first session', vi: 'Hoàn thành buổi tập đầu tiên' },
    target: 1,
    current: 1,
    earned: true,
    ...overrides,
  };
}

function makePr(overrides: Partial<PersonalRecord> = {}): PersonalRecord {
  return {
    exerciseId: 'ex-1',
    name: { en: 'Bench Press (fallback)', vi: 'Đẩy ngực (fallback)' },
    bestSet: { weightKg: 100, repsDone: 5, e1RM: 116.7 },
    ...overrides,
  };
}

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ex-1',
    slug: 'bench-press',
    name: { en: 'Bench Press', vi: 'Đẩy ngực' },
    muscleGroup: MuscleGroup.CHEST,
    equipmentType: EquipmentType.BARBELL,
    defaultIncrement: 2.5,
    isCustom: false,
    ...overrides,
  };
}

function makeWeightLog(overrides: Partial<WeightLog> = {}): WeightLog {
  return {
    id: 'w-1',
    userId: 'u1',
    weightKg: 75,
    loggedAt: new Date('2026-08-01T00:00:00.000Z'),
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('StatsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.getStatsSummary as unknown as Mock).mockResolvedValue(makeSummary());
    (api.getAwards as unknown as Mock).mockResolvedValue([]);
    (api.getPrs as unknown as Mock).mockResolvedValue([]);
    (api.getExercises as unknown as Mock).mockResolvedValue([]);
    (api.getWeightHistory as unknown as Mock).mockResolvedValue([]);
    (api.logWeight as unknown as Mock).mockResolvedValue(makeWeightLog());
  });

  it('renders 4 StatTiles with values from getStatsSummary', async () => {
    (api.getStatsSummary as unknown as Mock).mockResolvedValue(
      makeSummary({ totalSessions: 12, totalVolume: 34500, totalPrs: 5, totalExercises: 8 }),
    );

    renderPage();

    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.getByText('34500')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('shows an earned badge on an earned award and progress on an in-progress award', async () => {
    (api.getAwards as unknown as Mock).mockResolvedValue([
      makeAward({ key: AwardKey.FIRST_WORKOUT, name: { en: 'First Workout', vi: '' }, earned: true, current: 1, target: 1 }),
      makeAward({
        key: AwardKey.CONSISTENT_10,
        name: { en: 'Consistency', vi: '' },
        description: { en: 'Complete 10 sessions', vi: '' },
        earned: false,
        current: 3,
        target: 10,
      }),
    ]);

    renderPage();

    expect(await screen.findByText('First Workout')).toBeInTheDocument();
    expect(screen.getByText('Consistency')).toBeInTheDocument();
    expect(screen.getByText(/earned/i)).toBeInTheDocument();
    expect(screen.getByText('3/10')).toBeInTheDocument();
  });

  it('shows a PR row with the resolved exercise name joined from getExercises', async () => {
    (api.getPrs as unknown as Mock).mockResolvedValue([makePr({ exerciseId: 'ex-1' })]);
    (api.getExercises as unknown as Mock).mockResolvedValue([
      makeExercise({ id: 'ex-1', name: { en: 'Bench Press', vi: 'Đẩy ngực' } }),
    ]);

    renderPage();

    expect(await screen.findByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText(/100kg/)).toBeInTheDocument();
    expect(screen.getByText(/116\.7/)).toBeInTheDocument();
  });

  it('renders a MiniBarChart with 3 bars from getWeightHistory, and submitting the form calls logWeight', async () => {
    const user = userEvent.setup();
    (api.getWeightHistory as unknown as Mock).mockResolvedValue([
      makeWeightLog({ id: 'w-1', weightKg: 70, loggedAt: new Date('2026-08-01T00:00:00.000Z') }),
      makeWeightLog({ id: 'w-2', weightKg: 71, loggedAt: new Date('2026-08-08T00:00:00.000Z') }),
      makeWeightLog({ id: 'w-3', weightKg: 72, loggedAt: new Date('2026-08-15T00:00:00.000Z') }),
    ]);

    const { container } = renderPage();

    await waitFor(() => {
      expect(container.querySelectorAll('svg rect')).toHaveLength(3);
    });

    const input = await screen.findByLabelText(/weight/i);
    await user.clear(input);
    await user.type(input, '73.5');

    const submitButton = screen.getByRole('button', { name: /log weight/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(api.logWeight).toHaveBeenCalledWith({ weightKg: 73.5 });
    });
  });
});
