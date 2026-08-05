/**
 * Learner-state persistence (localStorage, versioned).
 * localStorage is sufficient here: state is a few hundred KB at most, and a
 * backend would add nothing for a single-learner offline app.
 */
import type { Content, LearnerState } from '../types';
import { newCard } from './srs';
import { initialChapterProgress } from './gate';
import { freshGamification } from './gamification';

const KEY = 'yoruba-ye-mi:learner:v1';
export const STATE_VERSION = 1;

export function freshState(content: Content, now = Date.now()): LearnerState {
  const cards: LearnerState['cards'] = {};
  for (const ch of content.chapters) {
    for (const item of ch.items) {
      cards[item.id] = newCard(item.id, ch.id, now);
    }
  }
  return {
    version: STATE_VERSION,
    cards,
    chapters: initialChapterProgress(content.chapters.map((c) => c.id)),
    quizHistory: [],
    streak: { lastDay: '', days: 0 },
    newPerDay: 10,
    introducedToday: { day: '', count: 0 },
    gamification: freshGamification(),
  };
}

export function load(content: Content): LearnerState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshState(content);
    const parsed = JSON.parse(raw) as LearnerState;
    if (parsed.version !== STATE_VERSION) return freshState(content);
    // saves that predate the gamification layer keep everything else as-is
    if (!parsed.gamification) parsed.gamification = freshGamification();
    // reconcile with content: add cards for any new items, keep existing state
    const fresh = freshState(content);
    for (const id of Object.keys(fresh.cards)) {
      if (!parsed.cards[id]) parsed.cards[id] = fresh.cards[id];
    }
    for (const chId of Object.keys(fresh.chapters)) {
      if (!parsed.chapters[Number(chId)]) parsed.chapters[Number(chId)] = fresh.chapters[Number(chId)];
    }
    return parsed;
  } catch {
    return freshState(content);
  }
}

export function save(state: LearnerState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to persist learner state', e);
  }
}

export function reset(): void {
  localStorage.removeItem(KEY);
}

export function touchStreak(state: LearnerState, now = Date.now()): LearnerState {
  const day = new Date(now).toISOString().slice(0, 10);
  if (state.streak.lastDay === day) return state;
  const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const days = state.streak.lastDay === yesterday ? state.streak.days + 1 : 1;
  return { ...state, streak: { lastDay: day, days } };
}
