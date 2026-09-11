import { content, useStore } from '../state/store';
import { canStudy, statusLabel } from '../lib/gate';
import { Icon } from './ui/icons';
import type { View } from '../App';
import type { ChapterStatus } from '../types';

function ChapterNode({ status, id }: { status: ChapterStatus; id: number }) {
  switch (status) {
    case 'passed':
      return (
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest-600 text-white shadow-soft dark:bg-forest-500">
          <Icon name="check" size={16} />
        </span>
      );
    case 'demoted':
      return (
        <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-gold-400 bg-gold-50 text-gold-600 dark:bg-gold-900/30 dark:text-gold-400">
          <Icon name="refresh" size={15} />
        </span>
      );
    case 'active':
      return (
        <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-forest-500 bg-white text-sm font-bold tabular-nums text-forest-600 shadow-soft dark:border-forest-400 dark:bg-ink-900 dark:text-forest-400">
          {id}
        </span>
      );
    case 'locked':
      return (
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 bg-ink-50 text-ink-300 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-600">
          <Icon name="lock" size={14} />
        </span>
      );
  }
}

export function Syllabus({ setView }: { setView: (v: View) => void }) {
  const { state } = useStore();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold" lang="yo">
          {content.meta.title}
        </h2>
        <p className="text-sm text-ink-500 dark:text-ink-400">{content.meta.author}</p>
        <p className="mt-2 max-w-2xl text-sm text-ink-600 dark:text-ink-300">
          The book's 12 chapters are sequential levels. Pass each chapter's assessment
          (80%+) to unlock the next. If your review accuracy on a passed chapter slips
          below 60%, it reopens and must be re-passed.
        </p>
      </div>
      <ol className="relative space-y-4">
        <span
          aria-hidden="true"
          className="absolute bottom-5 left-[1.125rem] top-5 w-px bg-ink-200 dark:bg-ink-800"
        />
        {content.chapters.map((ch) => {
          const prog = state.chapters[ch.id];
          const unlocked = canStudy(state.chapters, ch.id);
          const vocabCount = ch.items.filter((i) => i.type === 'vocab').length;
          const grammarCount = ch.items.filter((i) => i.type === 'grammar').length;
          return (
            <li key={ch.id} className={`relative flex gap-4 ${unlocked ? '' : 'opacity-55'}`}>
              <div className="relative z-10 shrink-0 pt-3">
                <ChapterNode status={prog.status} id={ch.id} />
              </div>
              <div className="card flex-1 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">
                    <span className="mr-2 text-ink-400 dark:text-ink-500">{ch.id}.</span>
                    {ch.title}{' '}
                    <span lang="yo" className="font-normal text-ink-500 dark:text-ink-400">
                      · {ch.yorubaTitle}
                    </span>
                  </h3>
                  <span className="text-xs text-ink-500 dark:text-ink-400">
                    {statusLabel(prog.status)} · {vocabCount} words · {grammarCount} lessons
                  </span>
                </div>
                {ch.objectives.length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-ink-600 dark:text-ink-300">
                    {ch.objectives.map((o, i) => (
                      <li key={i} lang="yo">
                        {o}
                      </li>
                    ))}
                  </ul>
                )}
                {unlocked && (
                  <div className="mt-3 flex gap-2">
                    <button
                      className="btn-secondary text-sm"
                      onClick={() => setView({ name: 'lesson', chapterId: ch.id })}
                    >
                      Study
                    </button>
                    <button
                      className="btn-primary text-sm"
                      onClick={() => setView({ name: 'assessment', chapterId: ch.id })}
                    >
                      {prog.status === 'passed' ? 'Retake assessment' : 'Take assessment'}
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
