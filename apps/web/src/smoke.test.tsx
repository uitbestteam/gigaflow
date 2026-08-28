import { render, screen } from '@testing-library/react';
import { App } from './App';
import { useAuthStore } from './store/authStore';

it('renders app', () => {
  // App now wraps the router in AuthGate, which shows a splash while
  // authStore.status === 'loading' (the store's default). Force a
  // resolved status so the header (and its "GigaFlow" brand link) renders.
  useAuthStore.setState({ status: 'guest' });
  render(<App />);
  expect(screen.getByText('GigaFlow')).toBeInTheDocument();
});
