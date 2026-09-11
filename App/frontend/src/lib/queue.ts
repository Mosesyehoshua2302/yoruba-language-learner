/**
 * Review-queue builder (micro progression).
 * The daily queue = all due SRS cards across unlocked chapters, mixed with a
 * capped number of new (not-yet-introduced) items from the current chapter.
 * Demoted chapters' cards are prioritised.
 */
import type { ChapterProgress, LearnerState, SrsCard } from '../types';
import { canStudy, currentChapterId } from './gate';
import { isDue } from './srs';

export interface QueueEntry {
  card: SrsCard;
  isNew: boolean;
}

export function buildQueue(
  state: LearnerState,
  now = Date.now(),
): QueueEntry[] {
  const chapters = state.chapters;
  const current = currentChapterId(chapters);
  const cards = Object.values(state.cards);

  const due = cards
    .filter((c) => canStudy(chapters, c.chapterId) && isDue(c, now))
    .sort((a, b) => {
      const ad = chapters[a.chapterId]?.status === 'demoted' ? 0 : 1;
      const bd = chapters[b.chapterId]?.status === 'demoted' ? 0 : 1;
      if (ad !== bd) return ad - bd;
      return a.due - b.due;
    });

  // new items only from the current chapter, respecting the daily cap
  const day = new Date(now).toISOString().slice(0, 10);
  const usedToday = state.introducedToday.day === day ? state.introducedToday.count : 0;
  const room = Math.max(0, state.newPerDay - usedToday);
  const fresh = cards
    .filter((c) => c.chapterId === current && !c.introduced)
    .slice(0, room);

  // interleave: reviews first, new items mixed into the middle
  const queue: QueueEntry[] = due.map((card) => ({ card, isNew: false }));
  fresh.forEach((card, i) => {
    const pos = Math.min(queue.length, (i + 1) * 3);
    queue.splice(pos, 0, { card, isNew: true });
  });
  return queue;
}

export function dueCounts(state: LearnerState, now = Date.now()) {
  const cards = Object.values(state.cards);
  const due = cards.filter((c) => canStudy(state.chapters, c.chapterId) && isDue(c, now));
  const byChapter: Record<number, number> = {};
  for (const c of due) byChapter[c.chapterId] = (byChapter[c.chapterId] ?? 0) + 1;
  return { total: due.length, byChapter };
}

export function demotedChapters(chapters: Record<number, ChapterProgress>): number[] {
  return Object.values(chapters)
    .filter((c) => c.status === 'demoted')
    .map((c) => c.chapterId)
    .sort((a, b) => a - b);
}
