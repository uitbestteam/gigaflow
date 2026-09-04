import type { ColorTag } from '@gigaflow/shared';
import { useTranslation } from 'react-i18next';
import { ColorDot } from './ColorDot';
import { Button } from './Button';
import { Card } from './Card';
import { DumbbellIcon, FlameIcon } from './icons';

export type SessionQueueStatus = 'done' | 'next' | 'upcoming';

export interface SessionQueueTemplate {
  id: string;
  name: string;
  colorTag: ColorTag;
}

export interface SessionQueueItemProps {
  template: SessionQueueTemplate;
  status: SessionQueueStatus;
  onStart?: () => void;
  className?: string;
}

const STATUS_TEXT_CLASSES: Record<Exclude<SessionQueueStatus, 'next'>, string> = {
  done: 'text-text-muted line-through',
  upcoming: 'text-text-secondary font-medium',
};

/**
 * The "up next" template is rendered as a bold focal hero (gradient-bordered
 * glow card + big CTA); everything else in the queue is a compact row.
 */
export function SessionQueueItem({ template, status, onStart, className = '' }: SessionQueueItemProps) {
  const { t } = useTranslation();

  if (status === 'next') {
    return (
      <Card variant="glow" className={`flex flex-col gap-4 ${className}`}>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-grad-primary shadow-glow-accent">
            <DumbbellIcon className="text-white" width={26} height={26} />
          </span>
          <div className="flex min-w-0 items-center gap-2">
            <ColorDot tag={template.colorTag} className="h-3 w-3 shrink-0" />
            <span className="truncate text-xl font-extrabold tracking-tight text-text">{template.name}</span>
          </div>
        </div>
        <Button size="lg" fullWidth onClick={onStart}>
          <FlameIcon width={20} height={20} />
          {t('home.startSession')}
        </Button>
      </Card>
    );
  }

  const classes = [
    'flex items-center gap-3 rounded-md p-3',
    status === 'upcoming' ? 'bg-surface-2' : '',
    status === 'done' ? 'opacity-60' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <ColorDot tag={template.colorTag} />
      <span className={STATUS_TEXT_CLASSES[status]}>{template.name}</span>
    </div>
  );
}
