/**
 * Gamification layer — XP, levels, badges. Purely additive engagement on
 * top of the real progression (chapter gates + SRS): it never unlocks or
 * blocks content, only reflects it back with a bit of momentum and
 * recognition. Pure functions only, mirroring gate.ts / srs.ts.
 *
 * No Yorùbá text is invented here. The two Yorùbá strings used for
 * celebratory moments are copied verbatim from the book's own content
 * (content.json items c9-v10 and c12-v113) and are never used as if they
 * were freshly authored translations.
 */
import type { Content, Grade, LearnerState, SrsCard } from '../types';
import { rollingAccuracy } from './srs';

export const XP_PER_GRADE: Record<Grade, number> = {
  again: 1,
  hard: 4,
  good: 8,
  easy: 12,
};

export const XP_PER_INTRODUCE = 3;
export const XP_ASSESSMENT_PASS = 150;
export const XP_ASSESSMENT_FAIL = 25;
export const XP_ASSESSMENT_SCORE_BONUS = 50; // scaled by score, only on pass

/** Cumulative XP required to *reach* `level` (level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(50 * (level - 1) * level);
}

export interface LevelInfo {
  level: number;
  title: string;
  xpTotal: number;
  xpIntoLevel: number;
  xpForNextLevel: number; // width of the current level's band
}

const LEVEL_TITLES = [
  'Beginner',
  'Beginner',
  'Learner',
  'Learner',
  'Practitioner',
  'Practitioner',
  'Adept',
  'Adept',
  'Adept',
  'Fluent Reader',
  'Fluent Reader',
  'Scholar',
];

export function titleForLevel(level: number): string {
  return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
}

export function levelForXp(xp: number): LevelInfo {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level += 1;
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  return {
    level,
    title: titleForLevel(level),
    xpTotal: xp,
    xpIntoLevel: xp - floor,
    xpForNextLevel: ceil - floor,
  };
}

export function freshGamification(): LearnerState['gamification'] {
  return { xp: 0, totalReviews: 0, currentReviewStreak: 0, bestReviewStreak: 0, unlockedBadges: [] };
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export type BadgeIcon =
  | 'seedling'
  | 'book'
  | 'compass'
  | 'trophy'
  | 'flame'
  | 'target'
  | 'medal'
  | 'quill'
  | 'clock'
  | 'star'
  | 'scroll'
  | 'headband'
  | 'crown'
  | 'lightning';

export interface Badge {
  id: string;
  label: string;
  description: string;
  icon: BadgeIcon;
  /** Verbatim quote from the book (content.json), shown as a small aside — never invented. */
  quote?: { yo: string; en: string; source: string };
}

export const BADGES: Badge[] = [
  {
    id: 'first-word',
    label: 'First Jutsu',
    description: 'Cast your first word into the review deck.',
    icon: 'scroll',
  },
  {
    id: 'chapter-1',
    label: 'Genin Rank',
    description: 'Passed the Chapter 1 assessment — academy graduate.',
    icon: 'headband',
  },
  {
    id: 'halfway',
    label: 'Mid-Arc Power-Up',
    description: 'Passed the Chapter 6 assessment — six to go.',
    icon: 'lightning',
  },
  {
    id: 'finisher',
    label: 'Legendary Protagonist',
    description: 'Passed every chapter in the book.',
    icon: 'crown',
    quote: { yo: 'kú iṣẹ́', en: 'well done!', source: 'Chapter 12 vocabulary' },
  },
  {
    id: 'streak-3',
    label: 'Training Arc: Day Three',
    description: 'Checked in three days in a row.',
    icon: 'flame',
  },
  {
    id: 'streak-7',
    label: 'Training Arc: Week One',
    description: 'A seven-day study streak.',
    icon: 'flame',
  },
  {
    id: 'streak-30',
    label: 'Training Arc: Full Month',
    description: 'A thirty-day study streak.',
    icon: 'flame',
  },
  {
    id: 'century',
    label: '100 Techniques Mastered',
    description: '100 words mastered.',
    icon: 'medal',
  },
  {
    id: 'wordsmith',
    label: 'Grandmaster Scroll',
    description: '500 words mastered.',
    icon: 'medal',
    quote: { yo: 'àṣeyọrí', en: 'success', source: 'Chapter 9 vocabulary' },
  },
  {
    id: 'grammarian',
    label: 'Rule Sage',
    description: '20 grammar points mastered.',
    icon: 'scroll',
  },
  {
    id: 'sharp-recall',
    label: 'Flow State',
    description: '20 correct reviews in a row.',
    icon: 'target',
  },
  {
    id: 'comeback',
    label: 'Redemption Arc',
    description: 'Re-passed a chapter after it was reopened for review.',
    icon: 'compass',
  },
  {
    id: 'perfectionist',
    label: 'S-Rank Clear',
    description: 'Scored 100% on a chapter assessment.',
    icon: 'star',
  },
  {
    id: 'dedicated',
    label: '500 Reps, No Filler',
    description: '500 review sessions completed.',
    icon: 'clock',
  },
];

export function badgeById(id: string): Badge | undefined {
  return BADGES.find((b) => b.id === id);
}

function masteredCount(cards: SrsCard[]): number {
  return cards.filter((c) => c.introduced && c.reps >= 2).length;
}

/**
 * Every badge id currently *eligible* given the state (excluding 'comeback',
 * which is a one-shot transition detected in the reducer, not a standing
 * condition). Called after any state-changing action; the reducer unions the
 * result into the persisted, append-only `unlockedBadges` list.
 */
export function eligibleBadgeIds(state: LearnerState, content: Content): string[] {
  const cards = Object.values(state.cards);
  const itemType: Record<string, 'vocab' | 'grammar'> = {};
  for (const ch of content.chapters) for (const item of ch.items) itemType[item.id] = item.type;
  const vocabCards = cards.filter((c) => itemType[c.itemId] === 'vocab');
  const grammarCards = cards.filter((c) => itemType[c.itemId] === 'grammar');

  const ids: string[] = [];
  if (cards.some((c) => c.introduced)) ids.push('first-word');
  const everPassed = (chapterId: number) => {
    const st = state.chapters[chapterId]?.status;
    return st === 'passed' || st === 'demoted';
  };
  if (everPassed(1)) ids.push('chapter-1');
  if (everPassed(6)) ids.push('halfway');
  if (Object.values(state.chapters).every((c) => c.status === 'passed')) ids.push('finisher');
  if (state.streak.days >= 3) ids.push('streak-3');
  if (state.streak.days >= 7) ids.push('streak-7');
  if (state.streak.days >= 30) ids.push('streak-30');
  if (masteredCount(vocabCards) >= 100) ids.push('century');
  if (masteredCount(vocabCards) >= 500) ids.push('wordsmith');
  if (masteredCount(grammarCards) >= 20) ids.push('grammarian');
  if (state.gamification.bestReviewStreak >= 20) ids.push('sharp-recall');
  if (state.quizHistory.some((r) => r.score >= 1)) ids.push('perfectionist');
  if (state.gamification.totalReviews >= 500) ids.push('dedicated');
  return ids;
}

export interface GradeGamificationInput {
  grade: Grade;
}

export function applyGradeGamification(
  g: LearnerState['gamification'],
  { grade }: GradeGamificationInput,
): LearnerState['gamification'] {
  const correct = grade !== 'again';
  const currentReviewStreak = correct ? g.currentReviewStreak + 1 : 0;
  return {
    ...g,
    xp: g.xp + XP_PER_GRADE[grade],
    totalReviews: g.totalReviews + 1,
    currentReviewStreak,
    bestReviewStreak: Math.max(g.bestReviewStreak, currentReviewStreak),
  };
}

export function applyIntroduceGamification(
  g: LearnerState['gamification'],
  newlyIntroducedCount: number,
): LearnerState['gamification'] {
  if (newlyIntroducedCount <= 0) return g;
  return { ...g, xp: g.xp + XP_PER_INTRODUCE * newlyIntroducedCount };
}

export function applyAssessmentGamification(
  g: LearnerState['gamification'],
  { score, passed }: { score: number; passed: boolean },
): LearnerState['gamification'] {
  const gained = passed
    ? XP_ASSESSMENT_PASS + Math.round(score * XP_ASSESSMENT_SCORE_BONUS)
    : XP_ASSESSMENT_FAIL;
  return { ...g, xp: g.xp + gained };
}

/** Union newly-eligible badges into the persisted, append-only list. */
export function sweepBadges(
  g: LearnerState['gamification'],
  state: LearnerState,
  content: Content,
  extraIds: string[] = [],
): { gamification: LearnerState['gamification']; newlyUnlocked: string[] } {
  const eligible = new Set([...eligibleBadgeIds(state, content), ...extraIds]);
  const already = new Set(g.unlockedBadges);
  const newlyUnlocked = [...eligible].filter((id) => !already.has(id));
  if (newlyUnlocked.length === 0) return { gamification: g, newlyUnlocked: [] };
  return {
    gamification: { ...g, unlockedBadges: [...g.unlockedBadges, ...newlyUnlocked] },
    newlyUnlocked,
  };
}

/** Recent-accuracy heuristic reused by the UI for a lightweight "form" indicator. */
export function recentForm(cards: SrsCard[]): number | null {
  return rollingAccuracy(cards, 5);
}
