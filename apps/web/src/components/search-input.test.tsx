import { render, screen, fireEvent } from '@testing-library/react';
import { SearchInput } from './SearchInput';

describe('SearchInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces rapid keystrokes into a single debounced onChange with the final value', () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} />);
    const input = screen.getByRole('searchbox');

    fireEvent.change(input, { target: { value: 'b' } });
    fireEvent.change(input, { target: { value: 'be' } });
    fireEvent.change(input, { target: { value: 'ben' } });
    fireEvent.change(input, { target: { value: 'bench' } });

    // Not yet fired: none of the intermediate keystrokes should have
    // triggered onChange, proving the timer resets on every keystroke
    // rather than firing once per change.
    expect(onChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(249);
    expect(onChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('bench');
  });

  it('cancels a pending debounce when the value prop resets externally, so the stale onChange never fires', () => {
    const onChange = vi.fn();
    // Start from an already-committed external value (as if a prior
    // debounce had already fired and the parent's state reflects it).
    const { rerender } = render(<SearchInput value="squat" onChange={onChange} />);
    const input = screen.getByRole('searchbox');

    // User starts typing more text; this is only local state until the
    // debounce elapses.
    fireEvent.change(input, { target: { value: 'squats' } });

    // Parent resets the controlled value (e.g. a "clear filters" action)
    // before the debounce for 'squats' has elapsed.
    rerender(<SearchInput value="" onChange={onChange} />);

    vi.advanceTimersByTime(250);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });
});
