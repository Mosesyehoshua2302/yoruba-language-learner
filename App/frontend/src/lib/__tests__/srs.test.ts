import { describe, expect, it } from 'vitest';
import { DAY_MS, isDue, newCard, review, rollingAccuracy } from '../srs';

const NOW = 1_700_000_000_000;

describe('SM-2 scheduler', () => {
  it('graduates a new card through 1d and 6d intervals', () => {
    let c = { ...newCard('x', 1, NOW), introduced: true };
    c = review(c, 4, NOW);
    expect(c.interval).toBe(1);
    expect(c.reps).toBe(1);
    expect(c.due).toBe(NOW + DAY_MS);
    c = review(c, 4, NOW + DAY_MS);
    expect(c.interval).toBe(6);
    c = review(c, 4, NOW + 7 * DAY_MS);
    expect(c.interval).toBe(Math.round(6 * c.ease));
  });

  it('resets interval and reps on a lapse and counts the lapse', () => {
    let c = { ...newCard('x', 1, NOW), introduced: true };
    c = review(c, 4, NOW);
    c = review(c, 4, NOW + DAY_MS);
    const easeBefore = c.ease;
    c = review(c, 1, NOW + 2 * DAY_MS);
    expect(c.reps).toBe(0);
    expect(c.interval).toBe(0);
    expect(c.lapses).toBe(1);
    expect(c.ease).toBeLessThan(easeBefore);
    // resurfaces within the session, not tomorrow
    expect(c.due - (NOW + 2 * DAY_MS)).toBeLessThan(DAY_MS);
  });

  it('never drops ease below 1.3', () => {
    let c = { ...newCard('x', 1, NOW), introduced: true };
    for (let i = 0; i < 20; i++) c = review(c, 0, NOW);
    expect(c.ease).toBeCloseTo(1.3);
  });

  it('isDue respects introduced flag', () => {
    const c = newCard('x', 1, NOW);
    expect(isDue(c, NOW + DAY_MS)).toBe(false);
    expect(isDue({ ...c, introduced: true }, NOW + 1)).toBe(true);
  });

  it('rollingAccuracy needs a minimum sample and averages history', () => {
    const c = { ...newCard('x', 1, NOW), history: [true, true, false, true] };
    expect(rollingAccuracy([c], 10)).toBeNull();
    expect(rollingAccuracy([c], 4)).toBeCloseTo(0.75);
  });
});
