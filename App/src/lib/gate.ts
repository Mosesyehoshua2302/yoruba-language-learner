/**
 * Chapter-gate (macro progression) logic.
 *
 * - Chapters unlock sequentially; chapter N+1 requires passing chapter N's
 *   assessment at >= PASS_THRESHOLD.
 * - Failed assessments record the missed items; the next assessment draws a
 *   fresh sample weighted toward those items.
 * - Demotion: if the rolling accuracy of a *passed* chapter's SRS cards
 *   falls below DEMOTE_THRESHOLD (with at least MIN_SAMPLES recent reviews),
 *   the chapter is reopened ('demoted') and must be re-passed before any
 *   forward progress.
 *
 * The gate draws its questions from the same SrsCard pool the review queue
 * uses — one source of truth per learner.
 */
import type {
  Chapter,
  ChapterProgress,
  ChapterStatus,
  LearnerState,
  SrsCard,
} from '../types';
import { rollingAccuracy } from './srs';

export const PASS_THRESHOLD = 0.8;
export const DEMOTE_THRESHOLD = 0.6;
export const MIN_SAMPLES = 10;

export function initialChapterProgress(chapterIds: number[]): Record<number, ChapterProgress> {
  const out: Record<number, ChapterProgress> = {};
  chapterIds.forEach((id, i) => {
    out[id] = {
      chapterId: id,
      status: i === 0 ? 'active' : 'locked',
      attempts: 0,
      missedItemIds: [],
    };
  });
  return out;
}

/** The chapter the learner should currently be working on. */
export function currentChapterId(chapters: Record<number, ChapterProgress>): number {
  const ids = Object.keys(chapters).map(Number).sort((a, b) => a - b);
  // demoted chapters block forward progress and take priority
  for (const id of ids) if (chapters[id].status === 'demoted') return id;
  for (const id of ids) if (chapters[id].status === 'active') return id;
  return ids[ids.length - 1]; // everything passed
}

export function canStudy(chapters: Record<number, ChapterProgress>, chapterId: number): boolean {
  const st = chapters[chapterId]?.status;
  return st === 'active' || st === 'passed' || st === 'demoted';
}

/** Apply an assessment result: pass/fail, unlocking and missed-item bookkeeping. */
export function applyAssessment(
  chapters: Record<number, ChapterProgress>,
  chapterId: number,
  score: number,
  missedItemIds: string[],
): Record<number, ChapterProgress> {
  const out: Record<number, ChapterProgress> = { ...chapters };
  const prog = { ...out[chapterId] };
  prog.attempts += 1;
  const passed = score >= PASS_THRESHOLD;
  if (passed) {
    prog.status = 'passed';
    prog.missedItemIds = [];
    // unlock the next locked chapter only if no demoted chapter blocks progress
    const ids = Object.keys(out).map(Number).sort((a, b) => a - b);
    const anyDemoted = ids.some((id) => id !== chapterId && out[id].status === 'demoted');
    if (!anyDemoted) {
      const next = ids.find((id) => id > chapterId && out[id].status === 'locked');
      if (next !== undefined && ids.filter((id) => id < next).every((id) => (id === chapterId ? true : out[id].status === 'passed'))) {
        out[next] = { ...out[next], status: 'active' };
      }
    }
  } else {
    // stay on the chapter; record misses for weighted re-drilling
    if (prog.status !== 'demoted') prog.status = 'active';
    prog.missedItemIds = missedItemIds;
  }
  out[chapterId] = prog;
  return out;
}

/**
 * Demotion sweep — run after review sessions. Any *passed* chapter whose
 * rolling review accuracy has dropped below DEMOTE_THRESHOLD is reopened.
 */
export function sweepDemotions(
  chapters: Record<number, ChapterProgress>,
  cardsByChapter: (chapterId: number) => SrsCard[],
): { chapters: Record<number, ChapterProgress>; demoted: number[] } {
  const out = { ...chapters };
  const demoted: number[] = [];
  for (const key of Object.keys(out)) {
    const id = Number(key);
    if (out[id].status !== 'passed') continue;
    const acc = rollingAccuracy(cardsByChapter(id), MIN_SAMPLES);
    if (acc !== null && acc < DEMOTE_THRESHOLD) {
      out[id] = { ...out[id], status: 'demoted', missedItemIds: [] };
      demoted.push(id);
    }
  }
  return { chapters: out, demoted };
}

export function statusLabel(status: ChapterStatus): string {
  switch (status) {
    case 'locked': return 'Locked';
    case 'active': return 'In progress';
    case 'passed': return 'Passed';
    case 'demoted': return 'Needs rework';
  }
}

/** Convenience: overall stats for the dashboard. */
export function chapterStats(state: LearnerState, chapter: Chapter) {
  const cards = chapter.items
    .map((i) => state.cards[i.id])
    .filter((c): c is SrsCard => Boolean(c));
  return {
    total: chapter.items.length,
    introduced: cards.filter((c) => c.introduced).length,
    accuracy: rollingAccuracy(cards, MIN_SAMPLES),
  };
}
