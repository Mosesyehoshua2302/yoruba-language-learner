import { useMemo, useState } from 'react';
import { content, useStore } from '../state/store';
import { canStudy } from '../lib/gate';
import { XP_PER_INTRODUCE } from '../lib/gamification';
import { Icon } from './ui/icons';
import type { View } from '../App';
import type { GrammarItem, VocabItem } from '../types';

function MissedDot() {
  return (
    <span
      title="missed on last assessment"
      className="inline-block h-2 w-2 shrink-0 rounded-full bg-gold-500 dark:bg-gold-400"
    />
  );
}

/**
 * Lesson view: presents new vocab/grammar before quizzing. Vocab is shown in
 * batches; "Add to reviews" marks the batch as introduced so it enters the
 * SRS queue.
 */
export function Lesson({ chapterId, setView }: { chapterId: number; setView: (v: View) => void }) {
  const { state, dispatch } = useStore();
  const chapter = content.chapters.find((c) => c.id === chapterId);
  const [tab, setTab] = useState<'vocab' | 'grammar'>('vocab');

  if (!chapter) return <p>Unknown chapter.</p>;
  if (!canStudy(state.chapters, chapterId)) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500">
          <Icon name="lock" size={20} />
        </span>
        <p className="mt-3 font-medium">Chapter {chapterId} is locked.</p>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          Pass the previous chapter's assessment to unlock it.
        </p>
        <button className="btn-secondary mt-4" onClick={() => setView({ name: 'syllabus' })}>
          Back to syllabus
        </button>
      </div>
    );
  }

  const vocab = chapter.items.filter((i): i is VocabItem => i.type === 'vocab');
  const grammar = chapter.items.filter((i): i is GrammarItem => i.type === 'grammar');
  const newVocab = vocab.filter((v) => !state.cards[v.id]?.introduced);
  const prog = state.chapters[chapterId];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl font-semibold">
          Chapter {chapter.id}: {chapter.title}{' '}
          <span lang="yo" className="text-lg font-normal text-ink-500 dark:text-ink-400">
            · {chapter.yorubaTitle}
          </span>
        </h2>
        <button className="btn-primary text-sm" onClick={() => setView({ name: 'assessment', chapterId })}>
          Take chapter assessment
        </button>
      </div>

      {prog.missedItemIds.length > 0 && (
        <div className="card flex items-center gap-2.5 border-gold-300/70 bg-gold-50/60 p-3 text-sm text-gold-800 dark:border-gold-500/30 dark:bg-gold-900/15 dark:text-gold-200">
          <MissedDot />
          <span>
            Your last assessment missed {prog.missedItemIds.length} item
            {prog.missedItemIds.length > 1 ? 's' : ''} — they are marked with a gold dot below and will
            be weighted heavily in the retake.
          </span>
        </div>
      )}

      <div className="inline-flex gap-1 rounded-xl bg-ink-100 p-1 dark:bg-ink-800">
        {(['vocab', 'grammar'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
              tab === t
                ? 'bg-white text-ink-900 shadow-soft dark:bg-ink-700 dark:text-ink-50'
                : 'text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200'
            }`}
          >
            {t === 'vocab' ? `Vocabulary (${vocab.length})` : `Grammar (${grammar.length})`}
          </button>
        ))}
      </div>

      {tab === 'vocab' && (
        <VocabTab
          vocab={vocab}
          newCount={newVocab.length}
          missed={prog.missedItemIds}
          introduced={(ids) => dispatch({ type: 'introduce', itemIds: ids })}
          isIntroduced={(id) => Boolean(state.cards[id]?.introduced)}
        />
      )}
      {tab === 'grammar' && (
        <div className="space-y-4">
          {grammar.map((g) => (
            <GrammarCard
              key={g.id}
              item={g}
              missed={prog.missedItemIds.includes(g.id)}
              introduced={Boolean(state.cards[g.id]?.introduced)}
              onLearn={() => dispatch({ type: 'introduce', itemIds: [g.id] })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VocabTab({
  vocab,
  newCount,
  missed,
  introduced,
  isIntroduced,
}: {
  vocab: VocabItem[];
  newCount: number;
  missed: string[];
  introduced: (ids: string[]) => void;
  isIntroduced: (id: string) => boolean;
}) {
  const groups = useMemo(() => {
    const by: Record<string, VocabItem[]> = {};
    for (const v of vocab) (by[v.pos] ??= []).push(v);
    return by;
  }, [vocab]);

  const BATCH = 10;
  const nextBatch = vocab.filter((v) => !isIntroduced(v.id)).slice(0, BATCH);

  return (
    <div className="space-y-5">
      {newCount > 0 && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-forest-300/50 bg-forest-50/50 p-4 dark:border-forest-500/30 dark:bg-forest-900/15">
          <div className="text-sm">
            <span className="font-medium">
              {newCount} word{newCount > 1 ? 's' : ''} not yet in your review deck.
            </span>
            <span className="ml-1.5 text-forest-600 dark:text-forest-400">
              +{nextBatch.length * XP_PER_INTRODUCE} XP
            </span>
          </div>
          <button className="btn-primary text-sm" onClick={() => introduced(nextBatch.map((v) => v.id))}>
            Add next {nextBatch.length} to reviews
          </button>
        </div>
      )}
      {Object.entries(groups).map(([pos, items]) => (
        <div key={pos}>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-ink-400 dark:text-ink-500">
            {pos}
          </h3>
          <div className="card divide-y divide-ink-100 dark:divide-ink-800">
            {items.map((v) => (
              <div key={v.id} className="flex items-baseline gap-3 px-4 py-2.5">
                <span lang="yo" className="min-w-[8rem] font-display text-[15px] font-medium">
                  {v.yo}
                </span>
                <span className="flex-1 text-sm text-ink-600 dark:text-ink-300">{v.en}</span>
                {missed.includes(v.id) && <MissedDot />}
                {isIntroduced(v.id) && (
                  <span title="in review deck" className="text-forest-500 dark:text-forest-400">
                    <Icon name="check" size={14} />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function GrammarCard({
  item,
  missed,
  introduced,
  onLearn,
}: {
  item: GrammarItem;
  missed: boolean;
  introduced: boolean;
  onLearn: () => void;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold" lang="yo">
          Lesson {item.lesson}: {item.title} {missed && <MissedDot />}
        </h3>
        {introduced ? (
          <span className="flex items-center gap-1 text-xs text-forest-600 dark:text-forest-400">
            <Icon name="check" size={13} />
            in review deck
          </span>
        ) : (
          <button className="btn-secondary text-xs" onClick={onLearn} title={`+${XP_PER_INTRODUCE} XP`}>
            Add to reviews
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-ink-700 dark:text-ink-200" lang="yo">
        {item.explanation}
      </p>
      {item.examples.length > 0 && (
        <div className="mt-3 space-y-1 border-l-2 border-forest-300/60 pl-3 dark:border-forest-500/40">
          {item.examples.map((ex, i) => (
            <div key={i} className="text-sm">
              <span lang="yo" className="font-medium">
                {ex.yo}
              </span>
              <span className="text-ink-500 dark:text-ink-400"> — {ex.en}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
