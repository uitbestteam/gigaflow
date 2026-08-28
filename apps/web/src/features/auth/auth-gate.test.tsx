import { render, screen } from '@testing-library/react';
import { useAuthStore } from '../../store/authStore';
import { AuthGate } from './AuthGate';

function setStatus(status: 'loading' | 'guest' | 'user' | 'error') {
  useAuthStore.setState({ status });
}

describe('AuthGate', () => {
  it('shows a splash while status is loading', () => {
    setStatus('loading');
    render(
      <AuthGate>
        <div>children</div>
      </AuthGate>,
    );
    expect(screen.getByTestId('auth-splash')).toBeInTheDocument();
    expect(screen.queryByText('children')).not.toBeInTheDocument();
  });

  it('renders children once status is guest', () => {
    setStatus('guest');
    render(
      <AuthGate>
        <div>children</div>
      </AuthGate>,
    );
    expect(screen.getByText('children')).toBeInTheDocument();
    expect(screen.queryByTestId('auth-splash')).not.toBeInTheDocument();
  });
});
