import type { HTMLAttributes, ReactNode } from 'react';

export type CardVariant = 'default' | 'glow' | 'flat';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  children?: ReactNode;
}

const VARIANT_CLASSES: Record<CardVariant, string> = {
  // Elevated surface with soft shadow — the app's default card.
  default: 'bg-surface border border-border-subtle shadow-card',
  // Gradient hairline border (see `.gradient-border` in tokens.css) for hero/CTA cards.
  glow: 'bg-surface border border-transparent gradient-border shadow-card',
  // Minimal, no shadow — for nested/inline groupings.
  flat: 'bg-surface-2 border border-border-subtle',
};

export function Card({ variant = 'default', className = '', children, ...rest }: CardProps) {
  const classes = ['rounded-lg p-4', VARIANT_CLASSES[variant], className].filter(Boolean).join(' ');

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
