import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'solid' | 'ghost' | 'outline' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children?: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // Primary CTA: neon gradient + glow. `solid` stays the default so existing
  // call-sites inherit the new primary look for free.
  solid: 'bg-grad-primary text-white shadow-glow-accent hover:brightness-110',
  ghost: 'bg-surface-2 text-text hover:bg-surface-3',
  outline: 'bg-transparent text-text border border-border hover:border-accent hover:text-accent',
  danger: 'bg-danger/90 text-white hover:bg-danger',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-sm rounded-sm',
  md: 'min-h-11 px-4 text-[15px] rounded-md',
  lg: 'min-h-[52px] px-6 text-base rounded-lg',
};

export function Button({
  variant = 'solid',
  size = 'md',
  fullWidth = false,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    'inline-flex items-center justify-center gap-2 min-w-11 font-semibold',
    'transition-all duration-150 select-none',
    'active:scale-[0.97] motion-reduce:active:scale-100',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:shadow-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    SIZE_CLASSES[size],
    VARIANT_CLASSES[variant],
    fullWidth ? 'w-full' : '',
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
