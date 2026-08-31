import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, type Mock } from 'vitest';
import { GenerationType, ImageMimeType, JobStatus } from '@gigaflow/shared';
import type { GenerationJob, InbodyResult } from '@gigaflow/shared';
import { InbodyPage } from './InbodyPage';

vi.mock('../../lib/api', () => ({
  analyzeInbody: vi.fn(),
  getInbodyJob: vi.fn(),
  getLatestInbody: vi.fn(),
}));

import * as api from '../../lib/api';

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/inbody']}>
        <InbodyPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function makeJob(overrides: Partial<GenerationJob>): GenerationJob {
  return {
    id: 'job-1',
    userId: 'u1',
    type: GenerationType.INBODY,
    status: JobStatus.QUEUED,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeInbodyResult(overrides: Partial<InbodyResult> = {}): InbodyResult {
  return {
    id: 'ib-1',
    userId: 'u1',
    metrics: { weightKg: 80, bodyFatPercent: 18 },
    takenAt: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('InbodyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders only the tiles for defined metrics', async () => {
    (api.getLatestInbody as unknown as Mock).mockResolvedValue(makeInbodyResult());

    renderPage();

    expect(await screen.findByText('80')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();

    expect(screen.queryByText(/bmi/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/skeletal muscle/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/fat mass/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/visceral/i)).not.toBeInTheDocument();
  });

  it('does not call analyzeInbody until a valid image is picked', async () => {
    (api.getLatestInbody as unknown as Mock).mockResolvedValue(null);

    renderPage();

    await screen.findByRole('button', { name: /analyze/i });

    const analyzeButton = screen.getByRole('button', { name: /analyze/i });
    expect(analyzeButton).toBeDisabled();

    fireEvent.click(analyzeButton);
    expect(api.analyzeInbody).not.toHaveBeenCalled();
  });

  it('picks an image, analyzes it, and renders the updated metrics once done', async () => {
    const user = userEvent.setup();

    (api.getLatestInbody as unknown as Mock).mockResolvedValueOnce(null);
    (api.analyzeInbody as unknown as Mock).mockResolvedValue({ jobId: 'job-1' });
    (api.getInbodyJob as unknown as Mock).mockResolvedValue(makeJob({ status: JobStatus.DONE }));
    (api.getLatestInbody as unknown as Mock).mockResolvedValueOnce(null).mockResolvedValue(
      makeInbodyResult({ metrics: { weightKg: 82, bmi: 24.1 } }),
    );

    renderPage();

    await screen.findByRole('button', { name: /analyze/i });

    const input = screen.getByLabelText(/upload/i) as HTMLInputElement;
    const file = new File(['ab'], 'inbody.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByRole('button', { name: /analyze/i })).not.toBeDisabled());

    await user.click(screen.getByRole('button', { name: /analyze/i }));

    expect(await screen.findByText('82')).toBeInTheDocument();
    expect(screen.getByText('24.1')).toBeInTheDocument();

    expect(api.analyzeInbody).toHaveBeenCalledWith({
      imageBase64: expect.any(String),
      mimeType: ImageMimeType.PNG,
    });
  });
});
