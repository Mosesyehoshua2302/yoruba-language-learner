/**
 * SM-2 spaced-repetition scheduler (SuperMemo-2, Wozniak 1990).
 *
 * Standard algorithm with two pragmatic extensions used by most modern
 * SRS apps (Anki-style):
 *  - a "learning step": brand-new or lapsed cards get sub-day intervals so
 *    they resurface within the same session before graduating;
 *  - a rolling result history per card, which the chapter-gate layer uses
 *    to compute rolling accuracy for the demotion rule.
 *
 * Pure functions only — no storage, no UI.
 */
import type { SrsCard, Grade } from '../types';

export const DAY_MS = 24 * 60 * 60 * 1000;
const LEARNING_STEP_MS = 10 * 60 * 1000; // failed/new cards come back in ~10 min
const HISTORY_WINDOW = 20;

export const GRADE_QUALITY: Record<Grade, number> = {
  again: 1, // total failure / wrong answer
  hard: 3,  // correct with serious difficulty
  good: 4,  // correct with some hesitation
  easy: 5,  // perfect recall
};

export function newCard(itemId: string, chapterId: number, now = Date.now()): SrsCard {
  return {
    itemId,
    chapterId,
    ease: 2.5,
    interval: 0,
    reps: 0,
    lapses: 0,
    due: now,
    introduced: false,
    history: [],
  };
}

/**
 * Apply an SM-2 review. `quality` is 0–5; below 3 counts as a lapse.
 * Returns a new card (does not mutate).
 */
export function review(card: SrsCard, quality: number, now = Date.now()): SrsCard {
  const q = Math.max(0, Math.min(5, quality));
  const correct = q >= 3;

  // SM-2 ease update (applied on every review, per the original algorithm)
  const ease = Math.max(
    1.3,
    card.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
  );

  let reps: number;
  let interval: number;
  let lapses = card.lapses;
  let due: number;

  if (!correct) {
    // Lapse: reset repetition count and interval (standard SM-2 behaviour);
    // resurface within the session via the learning step.
    reps = 0;
    interval = 0;
    if (card.reps > 0) lapses += 1;
    due = now + LEARNING_STEP_MS;
  } else {
    reps = card.reps + 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 6;
    else interval = Math.round(card.interval * ease);
    // "hard" answers grow the interval more slowly
    if (q === 3 && reps > 2) interval = Math.max(1, Math.round(card.interval * 1.2));
    due = now + interval * DAY_MS;
  }

  const history = [...card.history, correct].slice(-HISTORY_WINDOW);

  return { ...card, ease, reps, interval, lapses, due, history };
}

export function reviewWithGrade(card: SrsCard, grade: Grade, now = Date.now()): SrsCard {
  return review(card, GRADE_QUALITY[grade], now);
}

export function isDue(card: SrsCard, now = Date.now()): boolean {
  return card.introduced && card.due <= now;
}

/** Fraction of recent reviews answered correctly; null if too few samples. */
export function rollingAccuracy(cards: SrsCard[], minSamples = 10): number | null {
  const results = cards.flatMap((c) => c.history);
  if (results.length < minSamples) return null;
  return results.filter(Boolean).length / results.length;
}

/** Mastery heuristic for the dashboard: proportion of cards "known". */
export function mastery(cards: SrsCard[]): number {
  if (cards.length === 0) return 0;
  const score = cards.reduce((acc, c) => {
    if (!c.introduced) return acc;
    if (c.reps >= 2) return acc + 1;
    if (c.reps === 1) return acc + 0.5;
    return acc;
  }, 0);
  return score / cards.length;
}
