import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'solid' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children?: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  solid: 'bg-accent text-white',
  ghost: 'bg-transparent text-text-secondary border border-border',
};

export function Button({ variant = 'solid', className = '', children, ...rest }: ButtonProps) {
  const classes = [
    'inline-flex items-center justify-center min-h-11 min-w-11 px-4',
    'rounded-[10px] font-medium transition-colors',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    VARIANT_CLASSES[variant],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}
