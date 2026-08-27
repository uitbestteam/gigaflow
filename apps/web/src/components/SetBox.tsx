import { useRef } from 'react';

export type SetBoxStatus = 'pending' | 'done' | 'edited';

export interface SetBoxValue {
  weightKg: number;
  repsDone: number;
}

export interface SetBoxProps {
  target: SetBoxValue;
  actual?: SetBoxValue;
  status: SetBoxStatus;
  onTap: () => void;
  onEdit?: () => void;
  className?: string;
}

const STATUS_CLASSES: Record<SetBoxStatus, string> = {
  pending: 'bg-surface-elevated text-accent border border-border-subtle',
  done: 'bg-success/10 text-success border border-success',
  edited: 'bg-surface-elevated text-accent border border-warning',
};

const LONG_PRESS_MS = 500;
const CLICK_DEBOUNCE_MS = 220;

/**
 * A single loggable set. Pending shows the target (weight × reps) in blue;
 * done shows the actual value with a success tint; edited additionally
 * shows an amber dot to flag a manually adjusted value. Tap logs the set;
 * double-click or a long press (≥500ms) opens the editor.
 *
 * A plain click doesn't fire `onTap` immediately: the browser (and jsdom)
 * always dispatches two `click` events before `dblclick`, so a genuine
 * double-click would otherwise call `onTap` twice before `onEdit`. Instead
 * the first click starts a short debounce timer; a second click (or the
 * `dblclick` event) arriving inside that window cancels the pending tap and
 * routes to `onEdit` only.
 */
export function SetBox({ target, actual, status, onTap, onEdit, className = '' }: SetBoxProps) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const display = actual ?? target;

  const classes = [
    'relative inline-flex min-h-14 min-w-[72px] flex-col items-center justify-center',
    'rounded-[10px] tnum font-medium select-none touch-manipulation',
    'transition-colors motion-reduce:transition-none',
    STATUS_CLASSES[status],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const startLongPress = () => {
    longPressFired.current = false;
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      onEdit?.();
    }, LONG_PRESS_MS);
  };

  const clearLongPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const cancelPendingTap = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      return true;
    }
    return false;
  };

  return (
    <button
      type="button"
      className={classes}
      onClick={() => {
        if (longPressFired.current) {
          longPressFired.current = false;
          return;
        }
        // A second click arriving before the debounce fires means this is
        // (the start of) a double-click: cancel the pending single-tap and
        // let onDoubleClick drive onEdit instead of firing onTap here.
        if (cancelPendingTap()) return;
        clickTimer.current = setTimeout(() => {
          clickTimer.current = null;
          onTap();
        }, CLICK_DEBOUNCE_MS);
      }}
      onDoubleClick={() => {
        cancelPendingTap();
        onEdit?.();
      }}
      onPointerDown={startLongPress}
      onPointerUp={clearLongPress}
      onPointerLeave={clearLongPress}
      onPointerCancel={clearLongPress}
    >
      {status === 'edited' && (
        <span
          data-testid="set-box-edited-dot"
          aria-hidden="true"
          className="absolute right-1 top-1 h-2 w-2 rounded-full bg-warning"
        />
      )}
      <span>
        {display.weightKg} × {display.repsDone}
      </span>
    </button>
  );
}
