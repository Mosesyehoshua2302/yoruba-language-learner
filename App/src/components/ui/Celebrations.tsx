import { useEffect, useRef, useState } from 'react';
import { subscribeCelebrations, type CelebrationEvent } from '../../state/store';
import { badgeById, titleForLevel } from '../../lib/gamification';
import { Icon } from './icons';

interface Toast {
  id: number;
  event: CelebrationEvent;
}

const DISMISS_MS = 4200;

export function Celebrations() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeCelebrations((event) => {
      const id = nextId.current++;
      setToasts((t) => [...t, { id, event }]);
      timers.current.push(
        window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), DISMISS_MS),
      );
    });
    const pending = timers.current;
    return () => {
      unsubscribe();
      pending.forEach(clearTimeout);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-80 max-w-[calc(100vw-2.5rem)] flex-col gap-2">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const e = toast.event;
  if (e.kind === 'badge') {
    const badge = badgeById(e.badgeId);
    if (!badge) return null;
    return (
      <button
        onClick={onDismiss}
        className="card pointer-events-auto flex items-center gap-3 p-3 text-left shadow-soft-lg animate-pop-in"
      >
        <span className="medallion medallion--unlocked h-11 w-11 shrink-0">
          <Icon name={badge.icon} size={22} />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold-600 dark:text-gold-400">
            <Icon name="sparkle" size={12} />
            Badge unlocked
          </span>
          <span className="block truncate text-sm font-semibold">{badge.label}</span>
          <span className="block text-xs text-ink-500 dark:text-ink-400">{badge.description}</span>
          {badge.quote && (
            <span className="mt-0.5 block text-xs text-gold-600 dark:text-gold-400">
              <span lang="yo" className="font-medium">{badge.quote.yo}</span> — {badge.quote.en}
            </span>
          )}
        </span>
      </button>
    );
  }
  return (
    <button
      onClick={onDismiss}
      className="card pointer-events-auto flex items-center gap-3 p-3 text-left shadow-soft-lg animate-pop-in"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest-600 text-white dark:bg-forest-500">
        <span className="text-base font-bold tabular-nums">{e.level}</span>
      </span>
      <span>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-forest-600 dark:text-forest-400">
          <Icon name="sparkle" size={12} />
          Level up
        </span>
        <span className="block text-sm font-semibold">
          Level {e.level} — {titleForLevel(e.level)}
        </span>
      </span>
    </button>
  );
}
