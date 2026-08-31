import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageMimeType } from '@gigaflow/shared';
import { StatTile } from './StatTile';
import { MacroBar } from './MacroBar';
import { MiniBarChart } from './MiniBarChart';
import { JobProgress } from './JobProgress';
import { ImagePickerInput } from './ImagePickerInput';

describe('StatTile', () => {
  it('renders label + value + unit', () => {
    render(<StatTile label="Calories" value={2100} unit="kcal" />);
    expect(screen.getByText('Calories')).toBeInTheDocument();
    expect(screen.getByText('2100')).toBeInTheDocument();
    expect(screen.getByText('kcal')).toBeInTheDocument();
  });

  it('renders label + value without unit', () => {
    render(<StatTile label="Weight" value="72.5" />);
    expect(screen.getByText('Weight')).toBeInTheDocument();
    expect(screen.getByText('72.5')).toBeInTheDocument();
  });
});

describe('MacroBar', () => {
  it('renders the 4 numbers', () => {
    render(<MacroBar calories={2000} proteinG={150} carbsG={200} fatG={60} />);
    expect(screen.getByText('2000')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
  });
});

describe('MiniBarChart', () => {
  it('renders 3 rect bars for 3 points', () => {
    const { container } = render(
      <MiniBarChart
        points={[
          { label: 'Mon', value: 10 },
          { label: 'Tue', value: 20 },
          { label: 'Wed', value: 5 },
        ]}
      />,
    );
    expect(container.querySelectorAll('rect')).toHaveLength(3);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('shows empty-state text and no bars when points is empty', () => {
    const { container } = render(<MiniBarChart points={[]} />);
    expect(container.querySelectorAll('rect')).toHaveLength(0);
    expect(container.querySelectorAll('svg')).toHaveLength(0);
  });

  it('guards against a zero max value', () => {
    const { container } = render(
      <MiniBarChart points={[{ label: 'A', value: 0 }, { label: 'B', value: 0 }]} />,
    );
    expect(container.querySelectorAll('rect')).toHaveLength(2);
  });
});

describe('JobProgress', () => {
  it('shows the submitting status line', () => {
    render(<JobProgress status="submitting" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Submitting…')).toBeInTheDocument();
  });

  it('shows the polling status line', () => {
    render(<JobProgress status="polling" />);
    expect(screen.getByText('Processing…')).toBeInTheDocument();
  });

  it('shows the error text when status is error', () => {
    render(<JobProgress status="error" error="Something broke" />);
    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });
});

describe('ImagePickerInput', () => {
  it('rejects a non-image file with onError and does not call onPicked', async () => {
    const onPicked = vi.fn();
    const onError = vi.fn();
    render(<ImagePickerInput accept="image/*" maxBase64Length={1000} onPicked={onPicked} onError={onError} />);

    const input = screen.getByLabelText(/upload|choose|select/i) as HTMLInputElement;
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(onError).toHaveBeenCalledWith('inbody.errBadType'));
    expect(onPicked).not.toHaveBeenCalled();
  });

  it('accepts a valid small png and calls onPicked with stripped base64 + PNG mime', async () => {
    const onPicked = vi.fn();
    const onError = vi.fn();
    render(<ImagePickerInput accept="image/*" maxBase64Length={1000} onPicked={onPicked} onError={onError} />);

    const input = screen.getByLabelText(/upload|choose|select/i) as HTMLInputElement;
    const file = new File(['ab'], 'small.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(onPicked).toHaveBeenCalled());
    const [base64, mime] = onPicked.mock.calls[0] as [string, ImageMimeType];
    expect(base64).not.toMatch(/^data:/);
    expect(mime).toBe(ImageMimeType.PNG);
    expect(onError).not.toHaveBeenCalled();
  });

  it('rejects a valid image that exceeds maxBase64Length', async () => {
    const onPicked = vi.fn();
    const onError = vi.fn();
    render(<ImagePickerInput accept="image/*" maxBase64Length={1} onPicked={onPicked} onError={onError} />);

    const input = screen.getByLabelText(/upload|choose|select/i) as HTMLInputElement;
    const file = new File(['abcdefgh'], 'small.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(onError).toHaveBeenCalledWith('inbody.errTooLarge'));
    expect(onPicked).not.toHaveBeenCalled();
  });
});
