import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorTag } from '@gigaflow/shared';
import { Button } from './Button';
import { Card } from './Card';
import { Spinner } from './Spinner';
import { ColorDot } from './ColorDot';
import { LanguageToggle } from './LanguageToggle';

it('renders a solid button', () => {
  render(<Button>Go</Button>);
  const button = screen.getByRole('button', { name: 'Go' });
  expect(button).toBeInTheDocument();
  expect(button).toHaveClass('bg-accent');
});

it('renders a ghost button', () => {
  render(<Button variant="ghost">Cancel</Button>);
  const button = screen.getByRole('button', { name: 'Cancel' });
  expect(button).toHaveClass('text-text-secondary');
  expect(button).not.toHaveClass('bg-accent');
});

it('color dot uses tag color', () => {
  const { container } = render(<ColorDot tag={ColorTag.PUSH} />);
  expect(container.firstChild).toHaveClass('bg-push');
});

it('color dot maps every ColorTag member to a class', () => {
  Object.values(ColorTag).forEach((tag) => {
    const { container } = render(<ColorDot tag={tag} />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/\bbg-/);
  });
});

it('spinner is present', () => {
  render(<Spinner />);
  expect(screen.getByRole('status')).toBeInTheDocument();
});

it('renders card content', () => {
  render(<Card>Hello</Card>);
  expect(screen.getByText('Hello')).toBeInTheDocument();
});

it('language toggle is a controlled toggle', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<LanguageToggle value="en" onChange={onChange} />);
  const toggle = screen.getByRole('button', { name: /vi/i });
  await user.click(toggle);
  expect(onChange).toHaveBeenCalledWith('vi');
});
