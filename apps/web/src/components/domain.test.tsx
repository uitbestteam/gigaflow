import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorTag, MuscleGroup, EquipmentType } from '@gigaflow/shared';
import { SetBox } from './SetBox';
import { ExerciseRow } from './ExerciseRow';
import { SessionQueueItem } from './SessionQueueItem';
import { ProgressionBadge } from './ProgressionBadge';
import { SummaryRow } from './SummaryRow';
import { RestTimer } from './RestTimer';
import { RirPicker } from './RirPicker';

describe('SetBox', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('done state has success class and calls onTap on a single click (after the debounce)', () => {
    const onTap = vi.fn();
    render(
      <SetBox
        target={{ weightKg: 80, repsDone: 8 }}
        actual={{ weightKg: 80, repsDone: 8 }}
        status="done"
        onTap={onTap}
      />,
    );
    const box = screen.getByRole('button');
    expect(box.className).toMatch(/success/);
    fireEvent.click(box);
    // onTap is debounced briefly so a following click can still be
    // recognized as the start of a double-click.
    expect(onTap).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('pending state shows target text', () => {
    render(<SetBox target={{ weightKg: 60, repsDone: 10 }} status="pending" onTap={() => {}} />);
    expect(screen.getByText('60 × 10')).toBeInTheDocument();
  });

  it('edited state shows amber dot', () => {
    render(
      <SetBox
        target={{ weightKg: 60, repsDone: 10 }}
        actual={{ weightKg: 62.5, repsDone: 10 }}
        status="edited"
        onTap={() => {}}
      />,
    );
    expect(screen.getByTestId('set-box-edited-dot')).toBeInTheDocument();
  });

  it('double click calls onEdit and does NOT call onTap', () => {
    const onTap = vi.fn();
    const onEdit = vi.fn();
    render(
      <SetBox target={{ weightKg: 60, repsDone: 10 }} status="pending" onTap={onTap} onEdit={onEdit} />,
    );
    const box = screen.getByRole('button');
    // Real browsers (and jsdom via userEvent) always dispatch click, click,
    // dblclick in that order for a double-click; replicate that sequence
    // deterministically under fake timers.
    fireEvent.click(box);
    fireEvent.click(box);
    fireEvent.doubleClick(box);
    // Flush past the single-click debounce window to prove the pending tap
    // was cancelled, not merely delayed.
    vi.advanceTimersByTime(250);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onTap).not.toHaveBeenCalled();
  });
});

describe('ExerciseRow', () => {
  it('renders name, muscle tag and sets', () => {
    render(
      <ExerciseRow
        slot={{
          id: 's1',
          templateId: 't1',
          exerciseId: 'e1',
          orderIndex: 0,
          setsTarget: 3,
          repRangeMin: 8,
          repRangeMax: 12,
          equipmentType: EquipmentType.BARBELL,
          weightIncrement: 2.5,
          weightSuggested: 80,
          repsSuggested: 8,
          name: 'Bench Press',
          muscleGroup: MuscleGroup.CHEST,
          lastSets: [{ weightKg: 80, repsDone: 8 }],
        }}
        sets={[
          { target: { weightKg: 80, repsDone: 8 }, status: 'pending' },
          { target: { weightKg: 80, repsDone: 8 }, status: 'pending' },
        ]}
        onSetTap={() => {}}
        onSetEdit={() => {}}
      />,
    );
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText(MuscleGroup.CHEST)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /80/ })).toHaveLength(2);
  });
});

describe('SessionQueueItem', () => {
  it('"next" status shows Start and calls onStart', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(
      <SessionQueueItem
        template={{ id: 'tpl1', name: 'Push Day', colorTag: ColorTag.PUSH }}
        status="next"
        onStart={onStart}
      />,
    );
    const startButton = screen.getByRole('button', { name: /start/i });
    expect(startButton).toBeInTheDocument();
    await user.click(startButton);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('"upcoming" status does not show Start', () => {
    render(
      <SessionQueueItem template={{ id: 'tpl2', name: 'Pull Day', colorTag: ColorTag.PULL }} status="upcoming" />,
    );
    expect(screen.queryByRole('button', { name: /start/i })).not.toBeInTheDocument();
  });
});

describe('ProgressionBadge', () => {
  it('renders "prev: 80 × 8"', () => {
    render(<ProgressionBadge lastSet={{ weightKg: 80, repsDone: 8 }} />);
    expect(screen.getByText('prev: 80 × 8')).toBeInTheDocument();
  });

  it('renders nothing when no lastSet', () => {
    const { container } = render(<ProgressionBadge />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('SummaryRow', () => {
  it('with hasPR shows "PR"', () => {
    render(<SummaryRow name="Bench Press" setCount={3} avgWeightKg={80} hasPR />);
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText('PR')).toBeInTheDocument();
  });

  it('without hasPR does not show "PR"', () => {
    render(<SummaryRow name="Squat" setCount={3} avgWeightKg={100} hasPR={false} />);
    expect(screen.queryByText('PR')).not.toBeInTheDocument();
  });
});

describe('RestTimer', () => {
  it('formats mm:ss and toggles', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const onAdjust = vi.fn();
    render(<RestTimer seconds={90} running onToggle={onToggle} onAdjust={onAdjust} />);
    expect(screen.getByText('01:30')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /pause/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: '+15s' }));
    expect(onAdjust).toHaveBeenCalledWith(15);
    await user.click(screen.getByRole('button', { name: '-15s' }));
    expect(onAdjust).toHaveBeenCalledWith(-15);
  });

  it('shows Resume when not running', () => {
    render(<RestTimer seconds={5} running={false} onToggle={() => {}} onAdjust={() => {}} />);
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
  });
});

describe('RirPicker', () => {
  it('calls onPick with mapped rir values', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<RirPicker onPick={onPick} />);
    await user.click(screen.getByText('🙂'));
    expect(onPick).toHaveBeenCalledWith(3);
    await user.click(screen.getByText('💪'));
    expect(onPick).toHaveBeenCalledWith(1);
    await user.click(screen.getByText('😮‍💨'));
    expect(onPick).toHaveBeenCalledWith(0);
  });
});
