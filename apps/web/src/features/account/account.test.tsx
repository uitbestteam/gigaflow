import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { NotificationsSettings } from './NotificationsSettings';
import { AccountPage } from './AccountPage';
import { useNotificationStore } from '../../store/notificationStore';
import { useAuthStore } from '../../store/authStore';

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('NotificationsSettings', () => {
  beforeEach(() => {
    useNotificationStore.setState({ status: 'idle', token: undefined, error: undefined });
  });

  it('shows "Enable reminders" when idle and calls enable() on click', async () => {
    const user = userEvent.setup();
    const enableSpy = vi.spyOn(useNotificationStore.getState(), 'enable').mockResolvedValue();

    renderWithRouter(<NotificationsSettings />);

    const button = screen.getByRole('button', { name: /enable reminders/i });
    await user.click(button);

    await waitFor(() => {
      expect(enableSpy).toHaveBeenCalled();
    });
  });

  it('shows "Disable reminders" when enabled and calls disable() on click', async () => {
    const user = userEvent.setup();
    useNotificationStore.setState({ status: 'enabled', token: 'tok-1', error: undefined });
    const disableSpy = vi.spyOn(useNotificationStore.getState(), 'disable').mockResolvedValue();

    renderWithRouter(<NotificationsSettings />);

    const button = screen.getByRole('button', { name: /disable reminders/i });
    await user.click(button);

    await waitFor(() => {
      expect(disableSpy).toHaveBeenCalled();
    });
  });

  it('shows the denied hint when status is denied', () => {
    useNotificationStore.setState({ status: 'denied', token: undefined, error: undefined });

    renderWithRouter(<NotificationsSettings />);

    expect(screen.getByText(/allow notifications in your browser/i)).toBeInTheDocument();
  });
});

describe('AccountPage', () => {
  beforeEach(() => {
    useNotificationStore.setState({ status: 'idle', token: undefined, error: undefined });
  });

  it('shows the UpgradePrompt (and reminders) for a guest', () => {
    vi.spyOn(useNotificationStore.getState(), 'init').mockResolvedValue();
    useAuthStore.setState({ status: 'guest', isGuest: true, user: undefined });

    renderWithRouter(<AccountPage />);

    // From UpgradePrompt
    expect(screen.getByText(/save your progress/i)).toBeInTheDocument();
    // From NotificationsSettings
    expect(screen.getByRole('button', { name: /enable reminders/i })).toBeInTheDocument();
  });

  it('shows Sign out (not the UpgradePrompt) for a signed-in user', () => {
    vi.spyOn(useNotificationStore.getState(), 'init').mockResolvedValue();
    useAuthStore.setState({ status: 'user', isGuest: false, user: undefined });

    renderWithRouter(<AccountPage />);

    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByText(/save your progress/i)).not.toBeInTheDocument();
  });
});
