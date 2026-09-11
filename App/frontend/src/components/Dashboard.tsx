import { useEffect, useState } from 'react';
import { content, useStore } from '../state/store';
import { chapterStats, currentChapterId, statusLabel } from '../lib/gate';
import { dueCounts, demotedChapters } from '../lib/queue';
import { mastery } from '../lib/srs';
import { BADGES, levelForXp, type Badge } from '../lib/gamification';
import { Icon } from './ui/icons';
import { ProgressRing } from './ui/ProgressRing';
import type { View } from '../App';
import type { ChapterStatus, SrsCard } from '../types';

const STATUS_DOT: Record<ChapterStatus, string> = {
  passed: 'bg-forest-500',
  demoted: 'bg-gold-500',
  active: 'bg-sky-500',
  locked: 'bg-ink-300 dark:bg-ink-600',
};

export function Dashboard({ setView }: { setView: (v: View) => void }) {
  const { state } = useStore();
  const current = currentChapterId(state.chapters);
  const currentCh = content.chapters.find((c) => c.id === current)!;
  const due = dueCounts(state);
  const demoted = demotedChapters(state.chapters);
  const passedCount = Object.values(state.chapters).filter((c) => c.status === 'passed').length;
  const level = levelForXp(state.gamification.xp);
  const unlocked = new Set(state.gamification.unlockedBadges);
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null);
  const selectedBadge = selectedBadgeId ? BADGES.find((b) => b.id === selectedBadgeId) ?? null : null;

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card flex items-center gap-4 p-4">
          <ProgressRing
            value={level.xpIntoLevel / level.xpForNextLevel}
            size={64}
            strokeWidth={5}
            ringClassName="text-gold-500 dark:text-gold-400"
          >
            <span className="text-xl font-bold tabular-nums">{level.level}</span>
          </ProgressRing>
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wider text-ink-400 dark:text-ink-500">
              Level {level.level}
            </div>
            <div className="truncate font-display text-lg font-semibold">{level.title}</div>
            <div className="text-xs text-ink-500 dark:text-ink-400">
              {level.xpTotal.toLocaleString()} XP · {level.xpForNextLevel - level.xpIntoLevel} to next
            </div>
          </div>
        </div>

        <div className="card flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold-400/15 text-gold-600 dark:text-gold-400">
            <Icon name="flame" size={26} />
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums">
              {state.streak.days}
              <span className="ml-1 text-sm font-medium text-ink-500 dark:text-ink-400">
                {state.streak.days === 1 ? 'day' : 'days'}
              </span>
            </div>
            <div className="text-xs text-ink-500 dark:text-ink-400">
              study streak · best run {state.gamification.bestReviewStreak} correct
            </div>
          </div>
        </div>

        <div className="card flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-forest-500/10 text-forest-600 dark:text-forest-400">
            <Icon name="clock" size={24} />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-bold tabular-nums">{due.total}</div>
            <button
              onClick={() => setView({ name: 'review' })}
              className="group flex items-center gap-1 text-xs font-medium text-forest-600 hover:text-forest-500 dark:text-forest-400 dark:hover:text-forest-300"
            >
              due today — review now
              <Icon name="arrow-right" size={12} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>

        <div className="card flex items-center gap-4 p-4">
          <ProgressRing value={passedCount / content.chapters.length} size={48} strokeWidth={4}>
            <Icon name="book" size={18} className="text-forest-600 dark:text-forest-400" />
          </ProgressRing>
          <div>
            <div className="text-2xl font-bold tabular-nums">
              {passedCount}
              <span className="text-sm font-medium text-ink-500 dark:text-ink-400">/{content.chapters.length}</span>
            </div>
            <div className="text-xs text-ink-500 dark:text-ink-400">chapters passed</div>
          </div>
        </div>
      </section>

      {demoted.length > 0 && (
        <section className="card border-gold-300/70 bg-gold-50/60 p-4 dark:border-gold-500/30 dark:bg-gold-900/15">
          <h2 className="flex items-center gap-2 font-semibold text-gold-800 dark:text-gold-300">
            <Icon name="refresh" size={16} />
            Needs rework
          </h2>
          <p className="mt-1 text-sm text-gold-800/90 dark:text-gold-200/80">
            Your review accuracy on {demoted.length === 1 ? 'a passed chapter' : 'passed chapters'} dropped
            below 60%, so forward progress is paused until you re-pass:
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {demoted.map((id) => (
              <button
                key={id}
                className="btn-secondary text-sm"
                onClick={() => setView({ name: 'lesson', chapterId: id })}
              >
                Chapter {id}: {content.chapters.find((c) => c.id === id)?.title}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-wrap gap-3">
        <button className="btn-primary" onClick={() => setView({ name: 'review' })}>
          Start review ({due.total} due)
        </button>
        <button className="btn-secondary" onClick={() => setView({ name: 'lesson', chapterId: current })}>
          Continue Chapter {current}: {currentCh.title}
        </button>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Mastery by chapter</h2>
        <div className="card divide-y divide-ink-100 dark:divide-ink-800">
          {content.chapters.map((ch) => {
            const prog = state.chapters[ch.id];
            const cards = ch.items
              .map((i) => state.cards[i.id])
              .filter((c): c is SrsCard => Boolean(c));
            const m = mastery(cards);
            const stats = chapterStats(state, ch);
            const locked = prog.status === 'locked';
            return (
              <button
                key={ch.id}
                disabled={locked}
                onClick={() => setView({ name: 'lesson', chapterId: ch.id })}
                className={`flex w-full items-center gap-4 px-4 py-3 text-left transition-colors first:rounded-t-2xl last:rounded-b-2xl ${
                  locked
                    ? 'cursor-default opacity-50'
                    : 'hover:bg-ink-50 dark:hover:bg-ink-800/50'
                }`}
              >
                <ProgressRing value={m} size={38} strokeWidth={3.5}>
                  <span className="text-[10px] font-bold tabular-nums text-ink-500 dark:text-ink-400">
                    {Math.round(m * 100)}
                  </span>
                </ProgressRing>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold tabular-nums text-ink-400 dark:text-ink-500">
                      {ch.id}
                    </span>
                    <span className="truncate font-medium">{ch.title}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[prog.status]}`} />
                    {statusLabel(prog.status)}
                  </div>
                </div>
                <div className="text-right text-xs tabular-nums text-ink-500 dark:text-ink-400">
                  <div>
                    {stats.introduced}/{stats.total} seen
                  </div>
                  {stats.accuracy !== null && <div>{Math.round(stats.accuracy * 100)}% accuracy</div>}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Badges</h2>
        <div className="card grid grid-cols-3 gap-x-2 gap-y-5 p-5 sm:grid-cols-5 md:grid-cols-7">
          {BADGES.map((b) => {
            const has = unlocked.has(b.id);
            const medallion = (
              <span
                className={`medallion h-14 w-14 overflow-hidden ${
                  has
                    ? 'medallion--unlocked shimmer-surface motion-safe:hover:-translate-y-1 motion-safe:hover:scale-105 motion-safe:hover:rotate-[-3deg]'
                    : 'medallion--locked'
                }`}
              >
                <Icon name={has ? b.icon : 'lock'} size={22} />
              </span>
            );
            return (
              <div key={b.id} className="flex flex-col items-center gap-1.5 text-center">
                {has ? (
                  <button
                    type="button"
                    title={`${b.label} — ${b.description}`}
                    onClick={() => setSelectedBadgeId(b.id)}
                    className="rounded-full"
                  >
                    {medallion}
                  </button>
                ) : (
                  <div title={`${b.label} — ${b.description}`}>{medallion}</div>
                )}
                <span
                  className={`text-[11px] font-medium leading-tight ${
                    has ? '' : 'text-ink-400 dark:text-ink-600'
                  }`}
                >
                  {b.label}
                </span>
                {has && b.quote && (
                  <span className="text-[10px] leading-tight text-gold-600 dark:text-gold-400">
                    <span lang="yo">{b.quote.yo}</span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {selectedBadge && (
        <BadgeModal badge={selectedBadge} onClose={() => setSelectedBadgeId(null)} />
      )}

      {state.quizHistory.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Recent assessments</h2>
          <div className="card divide-y divide-ink-100 dark:divide-ink-800">
            {state.quizHistory.slice(-5).reverse().map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    r.passed
                      ? 'bg-forest-500/10 text-forest-600 dark:text-forest-400'
                      : 'bg-gold-400/15 text-gold-600 dark:text-gold-400'
                  }`}
                >
                  <Icon name={r.passed ? 'check' : 'x'} size={14} />
                </span>
                <span className="flex-1">
                  Chapter {r.chapterId}
                  <span className="ml-2 text-xs text-ink-400 dark:text-ink-500">
                    {new Date(r.timestamp).toLocaleDateString()}
                  </span>
                </span>
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    r.passed
                      ? 'text-forest-600 dark:text-forest-400'
                      : 'text-gold-600 dark:text-gold-400'
                  }`}
                >
                  {Math.round(r.score * 100)}%
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function BadgeModal({ badge, onClose }: { badge: Badge; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={badge.label}
        onClick={(e) => e.stopPropagation()}
        className="card animate-pop-in w-full max-w-xs space-y-3 p-6 text-center"
      >
        <span className="medallion medallion--unlocked mx-auto h-24 w-24">
          <Icon name={badge.icon} size={40} />
        </span>
        <div>
          <h3 className="font-display text-lg font-semibold">{badge.label}</h3>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{badge.description}</p>
        </div>
        {badge.quote && (
          <p className="text-sm text-gold-600 dark:text-gold-400">
            <span lang="yo" className="font-medium">
              {badge.quote.yo}
            </span>{' '}
            — {badge.quote.en}
          </p>
        )}
        <button className="btn-secondary w-full" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
