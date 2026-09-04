import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, type Mock } from 'vitest';
import { ActivityLevel, Gender, Goal, GenerationType, JobStatus, MealType } from '@gigaflow/shared';
import type { GenerationJob, MealPlanDoc } from '@gigaflow/shared';
import { MealPlannerPage } from './MealPlannerPage';

// framer-motion's AnimatePresence mode="wait" never completes its exit
// animation under jsdom, which strands wizard steps mid-transition. Render
// motion elements and AnimatePresence as plain passthroughs so step changes
// are synchronous and deterministic in tests.
vi.mock('framer-motion', async () => {
  const React = await import('react');
  const DROP = new Set([
    'initial',
    'animate',
    'exit',
    'transition',
    'variants',
    'custom',
    'layout',
    'layoutId',
    'whileTap',
    'whileHover',
    'whileFocus',
    'whileInView',
    'drag',
  ]);
  const clean = (props: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(props).filter(([k]) => !DROP.has(k)));
  // Cache one stable component per tag — a fresh component identity on every
  // access would remount the subtree each render and detach inputs.
  const cache = new Map<string, React.ElementType>();
  const motion = new Proxy(
    {},
    {
      get: (_t, tag: string) => {
        let comp = cache.get(tag);
        if (!comp) {
          comp = React.forwardRef((props: Record<string, unknown>, ref) =>
            React.createElement(tag, { ref, ...clean(props) }, props.children as React.ReactNode),
          );
          cache.set(tag, comp);
        }
        return comp;
      },
    },
  );
  return {
    __esModule: true,
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useReducedMotion: () => true,
  };
});

vi.mock('../../lib/api', () => ({
  generateMeal: vi.fn(),
  getMealJob: vi.fn(),
  getActiveMeal: vi.fn(),
}));

import * as api from '../../lib/api';

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/meal']}>
        <MealPlannerPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function makeJob(overrides: Partial<GenerationJob>): GenerationJob {
  return {
    id: 'job-1',
    userId: 'u1',
    type: GenerationType.MEAL,
    status: JobStatus.QUEUED,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeMealPlan(overrides: Partial<MealPlanDoc> = {}): MealPlanDoc {
  return {
    id: 'mp-1',
    userId: 'u1',
    name: 'My Meal Plan',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    days: [
      {
        dayIndex: 1,
        totalCalories: 2200,
        totalProteinG: 150,
        totalCarbsG: 220,
        totalFatG: 70,
        meals: [
          {
            name: { en: 'Oatmeal Bowl', vi: 'Yến mạch' },
            mealType: MealType.BREAKFAST,
            calories: 400,
            proteinG: 25,
            carbsG: 50,
            fatG: 10,
            ingredients: ['oats', 'milk', 'banana'],
          },
          {
            name: { en: 'Grilled Chicken', vi: 'Gà nướng' },
            mealType: MealType.LUNCH,
            calories: 600,
            proteinG: 50,
            carbsG: 40,
            fatG: 15,
            ingredients: ['chicken breast', 'rice', 'broccoli'],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('MealPlannerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the active meal plan with day totals and meals on mount', async () => {
    (api.getActiveMeal as unknown as Mock).mockResolvedValue(makeMealPlan());

    renderPage();

    expect(await screen.findByText('My Meal Plan')).toBeInTheDocument();
    expect(screen.getByText('2200')).toBeInTheDocument(); // MacroBar total calories
    expect(screen.getByText('150')).toBeInTheDocument(); // total protein
    expect(screen.getByText('Oatmeal Bowl')).toBeInTheDocument();
    expect(screen.getByText('Grilled Chicken')).toBeInTheDocument();
    expect(screen.getByText('400')).toBeInTheDocument();
    expect(screen.getByText('600')).toBeInTheDocument();
  });

  it('submits the generate form and shows the new plan once done', async () => {
    const user = userEvent.setup();

    (api.getActiveMeal as unknown as Mock).mockResolvedValueOnce(null);
    (api.generateMeal as unknown as Mock).mockResolvedValue({ jobId: 'job-1' });
    (api.getMealJob as unknown as Mock).mockResolvedValue(makeJob({ status: JobStatus.DONE }));
    (api.getActiveMeal as unknown as Mock).mockResolvedValueOnce(null).mockResolvedValue(makeMealPlan());

    renderPage();

    // Step 1 — goal
    await screen.findByRole('button', { name: /weight loss/i });
    await user.click(screen.getByRole('button', { name: /weight loss/i }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // Step 2 — body
    await user.click(screen.getByRole('button', { name: /female/i }));

    const ageInput = screen.getByLabelText(/age/i);
    await user.clear(ageInput);
    await user.type(ageInput, '28');

    const heightInput = screen.getByLabelText(/height/i);
    await user.clear(heightInput);
    await user.type(heightInput, '165');

    const weightInput = screen.getByLabelText(/weight/i);
    await user.clear(weightInput);
    await user.type(weightInput, '60');

    await user.click(screen.getByRole('button', { name: /moderate/i }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // Step 3 — cuisine (skip)
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // Step 4 — diet & allergies (skip)
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // Step 5 — preferences (skip) then finish
    await user.click(screen.getByRole('button', { name: /generate meal plan/i }));

    expect(await screen.findByText('My Meal Plan')).toBeInTheDocument();

    expect(api.generateMeal).toHaveBeenCalledWith({
      goal: Goal.WEIGHT_LOSS,
      gender: Gender.FEMALE,
      age: 28,
      heightCm: 165,
      weightKg: 60,
      activityLevel: ActivityLevel.MODERATE,
    });
  });
});
