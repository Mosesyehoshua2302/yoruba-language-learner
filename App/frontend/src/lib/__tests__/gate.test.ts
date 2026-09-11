import { describe, expect, it } from 'vitest';
import {
  applyAssessment,
  currentChapterId,
  initialChapterProgress,
  sweepDemotions,
} from '../gate';
import { newCard } from '../srs';
import type { SrsCard } from '../../types';

const ids = [1, 2, 3];

describe('chapter gates', () => {
  it('starts with only chapter 1 active', () => {
    const ch = initialChapterProgress(ids);
    expect(ch[1].status).toBe('active');
    expect(ch[2].status).toBe('locked');
    expect(currentChapterId(ch)).toBe(1);
  });

  it('passing at >=80% unlocks the next chapter', () => {
    let ch = initialChapterProgress(ids);
    ch = applyAssessment(ch, 1, 0.8, []);
    expect(ch[1].status).toBe('passed');
    expect(ch[2].status).toBe('active');
    expect(currentChapterId(ch)).toBe(2);
  });

  it('failing below 80% keeps the chapter active and records misses', () => {
    let ch = initialChapterProgress(ids);
    ch = applyAssessment(ch, 1, 0.75, ['c1-v3', 'c1-g1']);
    expect(ch[1].status).toBe('active');
    expect(ch[2].status).toBe('locked');
    expect(ch[1].missedItemIds).toEqual(['c1-v3', 'c1-g1']);
    expect(ch[1].attempts).toBe(1);
  });

  it('demotes a passed chapter when rolling accuracy < 60%', () => {
    let ch = initialChapterProgress(ids);
    ch = applyAssessment(ch, 1, 0.9, []);
    const badCards: SrsCard[] = [
      { ...newCard('a', 1), history: [false, false, false, true, false, false] },
      { ...newCard('b', 1), history: [false, true, false, false, false, true] },
    ];
    const { chapters, demoted } = sweepDemotions(ch, () => badCards);
    expect(demoted).toEqual([1]);
    expect(chapters[1].status).toBe('demoted');
    // demoted chapter becomes the current chapter again
    expect(currentChapterId(chapters)).toBe(1);
  });

  it('does not demote with too few samples or accuracy >= 60%', () => {
    let ch = initialChapterProgress(ids);
    ch = applyAssessment(ch, 1, 0.9, []);
    const few: SrsCard[] = [{ ...newCard('a', 1), history: [false, false] }];
    expect(sweepDemotions(ch, () => few).demoted).toEqual([]);
    const ok: SrsCard[] = [
      { ...newCard('a', 1), history: Array(10).fill(true).map((_, i) => i < 7) },
    ];
    expect(sweepDemotions(ch, () => ok).demoted).toEqual([]);
  });

  it('a demoted chapter blocks unlocking further chapters until re-passed', () => {
    let ch = initialChapterProgress(ids);
    ch = applyAssessment(ch, 1, 0.9, []);
    // demote ch1 while ch2 active
    const bad: SrsCard[] = [{ ...newCard('a', 1), history: Array(12).fill(false) }];
    ch = sweepDemotions(ch, (id) => (id === 1 ? bad : [])).chapters;
    // passing ch2 must NOT unlock ch3 while ch1 is demoted
    ch = applyAssessment(ch, 2, 1, []);
    expect(ch[2].status).toBe('passed');
    expect(ch[3].status).toBe('locked');
    // re-pass ch1 -> forward progress resumes
    ch = applyAssessment(ch, 1, 0.85, []);
    expect(ch[1].status).toBe('passed');
    expect(currentChapterId(ch)).toBe(3);
  });
});
