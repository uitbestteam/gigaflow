import { ColorTag } from '@gigaflow/shared';

export interface ColorDotProps {
  tag: ColorTag;
  className?: string;
}

/**
 * Maps every ColorTag member to a background color utility class.
 * PUSH/PULL/LEGS map to their dedicated tokens (bg-push/bg-pull/bg-legs).
 * UPPER/LOWER/FULL don't have dedicated tokens yet, so they reuse existing
 * tokens with a sensible meaning: UPPER -> accent (primary focus color),
 * LOWER -> success (secondary), FULL -> warning (spans both). CUSTOM falls
 * back to surface-elevated, a neutral token, since it has no inherent color.
 */
const TAG_CLASSES: Record<ColorTag, string> = {
  [ColorTag.PUSH]: 'bg-push',
  [ColorTag.PULL]: 'bg-pull',
  [ColorTag.LEGS]: 'bg-legs',
  [ColorTag.UPPER]: 'bg-accent',
  [ColorTag.LOWER]: 'bg-success',
  [ColorTag.FULL]: 'bg-warning',
  [ColorTag.CUSTOM]: 'bg-surface-elevated',
};

export function ColorDot({ tag, className = '' }: ColorDotProps) {
  const classes = [
    'inline-block h-[28px] w-[28px] rounded-full',
    TAG_CLASSES[tag],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={classes} aria-hidden="true" />;
}
