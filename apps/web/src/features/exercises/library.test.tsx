import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, type Mock } from 'vitest';
import { EquipmentType, MuscleGroup } from '@gigaflow/shared';
import type { Exercise } from '@gigaflow/shared';
import { ExerciseLibraryPage } from './ExerciseLibraryPage';
import * as api from '../../lib/api';

vi.mock('../../lib/api', () => ({
  getExercises: vi.fn(),
  createExercise: vi.fn(),
}));

function renderLibrary() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ExerciseLibraryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
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

describe('ExerciseLibraryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.getExercises as unknown as Mock).mockResolvedValue([]);
    (api.createExercise as unknown as Mock).mockResolvedValue(makeExercise());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders 2 exercise list items with resolved names', async () => {
    (api.getExercises as unknown as Mock).mockResolvedValue([
      makeExercise({ id: 'ex-1', name: { en: 'Bench Press', vi: 'Đẩy ngực' } }),
      makeExercise({ id: 'ex-2', name: { en: 'Squat', vi: 'Gánh tạ' } }),
    ]);

    renderLibrary();

    expect(await screen.findByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText('Squat')).toBeInTheDocument();
  });

  it('coalesces rapid typing into a single debounced getExercises call with the final {q}', async () => {
    renderLibrary();

    const searchInput = await screen.findByPlaceholderText(/search/i);

    // Let the initial mount-time query settle before measuring new calls
    // triggered by typing.
    await waitFor(() => {
      expect(api.getExercises).toHaveBeenCalledTimes(1);
    });
    (api.getExercises as unknown as Mock).mockClear();

    vi.useFakeTimers();

    fireEvent.change(searchInput, { target: { value: 'b' } });
    fireEvent.change(searchInput, { target: { value: 'be' } });
    fireEvent.change(searchInput, { target: { value: 'ben' } });
    fireEvent.change(searchInput, { target: { value: 'bench' } });

    // No call yet: each keystroke should reset the debounce timer rather
    // than firing one call per keystroke.
    expect(api.getExercises).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(249);
    });
    expect(api.getExercises).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(api.getExercises).toHaveBeenCalledTimes(1);
    });
    expect(api.getExercises).toHaveBeenCalledWith(expect.objectContaining({ q: 'bench' }));
  });

  it('calls getExercises with the selected muscleGroup when a chip is clicked', async () => {
    const user = userEvent.setup();

    renderLibrary();

    const chestChip = await screen.findByRole('button', { name: /chest/i });
    await user.click(chestChip);

    await waitFor(() => {
      const lastCall = (api.getExercises as unknown as Mock).mock.calls.at(-1);
      expect(lastCall?.[0]).toEqual(expect.objectContaining({ muscleGroup: MuscleGroup.CHEST }));
    });
  });

  it('calls createExercise with the built CreateExerciseInput when the custom form is submitted', async () => {
    const user = userEvent.setup();

    renderLibrary();

    const toggleButton = await screen.findByRole('button', { name: /custom/i });
    await user.click(toggleButton);

    const nameEnInput = await screen.findByLabelText(/name.*english|english.*name/i);
    const nameViInput = await screen.findByLabelText(/name.*vietnamese|vietnamese.*name/i);
    await user.type(nameEnInput, 'Cable Fly');
    await user.type(nameViInput, 'Bay cáp');

    const muscleSelect = screen.getByLabelText(/muscle group/i);
    await user.selectOptions(muscleSelect, MuscleGroup.CHEST);

    const equipmentSelect = screen.getByLabelText(/equipment/i);
    await user.selectOptions(equipmentSelect, EquipmentType.CABLE);

    const submitButton = screen.getByRole('button', { name: /add|save|submit/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(api.createExercise).toHaveBeenCalledWith(
        expect.objectContaining({
          name: { en: 'Cable Fly', vi: 'Bay cáp' },
          muscleGroup: MuscleGroup.CHEST,
          equipmentType: EquipmentType.CABLE,
        }),
      );
    });
  });
});
