import type { ColorTag } from '@gigaflow/shared';
import { useTranslation } from 'react-i18next';
import { ColorDot } from './ColorDot';
import { Button } from './Button';

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

const STATUS_TEXT_CLASSES: Record<SessionQueueStatus, string> = {
  done: 'text-text-muted line-through',
  next: 'text-text',
  upcoming: 'text-text-secondary',
};

export function SessionQueueItem({ template, status, onStart, className = '' }: SessionQueueItemProps) {
  const { t } = useTranslation();

  const classes = [
    'flex items-center justify-between gap-3 rounded-[10px] p-3',
    status === 'next' ? 'bg-surface-elevated' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <div className="flex items-center gap-3">
        <ColorDot tag={template.colorTag} />
        <span className={STATUS_TEXT_CLASSES[status]}>{template.name}</span>
      </div>
      {status === 'next' && (
        <Button onClick={onStart}>{t('home.startSession')}</Button>
      )}
    </div>
  );
}
