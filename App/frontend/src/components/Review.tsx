import { useMemo, useState } from 'react';
import { content, useStore } from '../state/store';
import { buildQueue } from '../lib/queue';
import { currentChapterId } from '../lib/gate';
import { XP_PER_GRADE } from '../lib/gamification';
import { Icon } from './ui/icons';
import type { View } from '../App';
import type { ContentItem, Grade } from '../types';

const itemIndex: Record<string, { item: ContentItem; chapterId: number }> = {};
for (const ch of content.chapters) for (const it of ch.items) itemIndex[it.id] = { item: it, chapterId: ch.id };

const GRADE_BUTTONS: { grade: Grade; label: string; sub: string; cls: string }[] = [
  {
    grade: 'again',
    label: 'Again',
    sub: 'wrong',
    cls: 'border-rose-300/70 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20',
  },
  {
    grade: 'hard',
    label: 'Hard',
    sub: 'barely',
    cls: 'border-gold-300/70 bg-gold-50 text-gold-700 hover:bg-gold-100 dark:border-gold-500/30 dark:bg-gold-500/10 dark:text-gold-300 dark:hover:bg-gold-500/20',
  },
  {
    grade: 'good',
    label: 'Good',
    sub: 'ok',
    cls: 'border-forest-300/70 bg-forest-50 text-forest-700 hover:bg-forest-100 dark:border-forest-500/30 dark:bg-forest-500/10 dark:text-forest-300 dark:hover:bg-forest-500/20',
  },
  {
    grade: 'easy',
    label: 'Easy',
    sub: 'instant',
    cls: 'border-sky-300/70 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/20',
  },
];

/** Daily SRS review session: flip card, self-grade (SM-2 quality mapping). */
export function Review({ setView }: { setView: (v: View) => void }) {
  const { state, dispatch } = useStore();
  const queue = useMemo(() => buildQueue(state, Date.now()), [state]);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);

  if (queue.length === 0) {
    return (
      <div className="card mx-auto max-w-md space-y-4 p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-forest-500/10 text-forest-600 dark:text-forest-400">
          <Icon name="check" size={28} />
        </span>
        <div>
          <p className="font-display text-lg font-semibold">
            {done > 0 ? 'Session complete' : 'Nothing due right now'}
          </p>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            {done > 0
              ? `You reviewed ${done} card${done > 1 ? 's' : ''} and earned ${sessionXp} XP.`
              : 'Learn new words in the current chapter, or come back tomorrow.'}
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <button className="btn-secondary" onClick={() => setView({ name: 'dashboard' })}>
            Dashboard
          </button>
          <button
            className="btn-primary"
            onClick={() => setView({ name: 'lesson', chapterId: currentChapterId(state.chapters) })}
          >
            Learn
          </button>
        </div>
      </div>
    );
  }

  const entry = queue[0];
  const info = itemIndex[entry.card.itemId];
  if (!info) return null;
  const { item, chapterId } = info;
  const total = done + queue.length;

  const grade = (g: Grade) => {
    setRevealed(false);
    setDone((d) => d + 1);
    setSessionXp((xp) => xp + XP_PER_GRADE[g]);
    dispatch({ type: 'grade-card', itemId: item.id, grade: g });
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <div className="flex items-center justify-between text-sm text-ink-500 dark:text-ink-400">
          <span className="flex items-center gap-2 tabular-nums">
            {done} of {total}
            {entry.isNew && (
              <span className="rounded-full bg-forest-500/10 px-2 py-px text-xs font-medium text-forest-600 dark:text-forest-400">
                new item
              </span>
            )}
          </span>
          <span className="flex items-center gap-3 tabular-nums">
            {sessionXp > 0 && <span className="text-gold-600 dark:text-gold-400">+{sessionXp} XP</span>}
            <span>Chapter {chapterId}</span>
          </span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
          <div
            className="h-full rounded-full bg-forest-500 transition-all duration-500 dark:bg-forest-400"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="flip-scene" key={`${item.id}:${done}`}>
        <div className={`flip-card ${revealed ? 'is-flipped' : ''}`}>
          <div className="flip-face card flex min-h-[18rem] flex-col items-center justify-center p-8 text-center">
            {item.type === 'vocab' ? (
              <>
                <p className="font-display text-4xl font-semibold" lang="yo">
                  {item.yo}
                </p>
                <p className="mt-3 text-xs uppercase tracking-widest text-ink-400 dark:text-ink-500">
                  {item.pos}
                </p>
              </>
            ) : (
              <>
                <p className="mb-2 text-xs uppercase tracking-widest text-ink-400 dark:text-ink-500">
                  Grammar — Lesson {item.lesson}
                </p>
                <p className="font-display text-2xl font-semibold" lang="yo">
                  {item.title}
                </p>
              </>
            )}
          </div>
          <div className="flip-face flip-face-back card min-h-[18rem] overflow-y-auto p-8">
            {item.type === 'vocab' ? (
              <div className="flex h-full min-h-[14rem] flex-col items-center justify-center text-center">
                <p className="text-sm text-ink-400 dark:text-ink-500" lang="yo">
                  {item.yo}
                </p>
                <p className="mt-2 text-2xl font-semibold">{item.en}</p>
              </div>
            ) : (
              <div className="text-left">
                <p className="font-display text-lg font-semibold" lang="yo">
                  {item.title}
                </p>
                <p className="mt-2 text-sm text-ink-700 dark:text-ink-200" lang="yo">
                  {item.explanation}
                </p>
                <div className="mt-3 space-y-1.5 border-l-2 border-forest-300/60 pl-3 dark:border-forest-500/40">
                  {item.examples.slice(0, 3).map((ex, i) => (
                    <p key={i} className="text-sm">
                      <span lang="yo" className="font-medium">
                        {ex.yo}
                      </span>
                      <span className="text-ink-500 dark:text-ink-400"> — {ex.en}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {!revealed ? (
        <button className="btn-primary w-full py-3" onClick={() => setRevealed(true)}>
          Show answer
        </button>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {GRADE_BUTTONS.map(({ grade: g, label, sub, cls }) => (
            <button
              key={g}
              onClick={() => grade(g)}
              className={`rounded-xl border py-2.5 text-sm font-semibold transition-all active:scale-[0.97] ${cls}`}
            >
              {label}
              <span className="block text-[11px] font-normal opacity-75">
                {sub} · +{XP_PER_GRADE[g]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
