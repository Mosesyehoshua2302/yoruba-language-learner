/**
 * Learner-state persistence (localStorage, versioned).
 * localStorage is sufficient here: state is a few hundred KB at most, and a
 * backend would add nothing for a single-learner offline app.
 */
import type { Content, LearnerState } from "../types";
import { newCard } from "./srs";
import { initialChapterProgress } from "./gate";
import { freshGamification } from "./gamification";

const KEY_BASE = "yoruba-ye-mi:learner:v1";
export const STATE_VERSION = 1;

/**
 * localStorage key, namespaced per user. With the hard auth gate every user has
 * a Cognito `sub`; namespacing keeps one user's cached state from being shown to
 * another on a shared browser. Local dev (no auth) uses the fixed `local` sub.
 */
function keyFor(sub: string): string {
  return `${KEY_BASE}:${sub}`;
}

export function freshState(content: Content, now = Date.now()): LearnerState {
  const cards: LearnerState["cards"] = {};
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
    streak: { lastDay: "", days: 0 },
    newPerDay: 10,
    introducedToday: { day: "", count: 0 },
    gamification: freshGamification(),
  };
}

/**
 * Reconcile a persisted (or server-fetched) state against current content:
 * add cards/chapters for any items added to content.json since the state was
 * saved, keeping everything else as-is. Returns freshState on version
 * mismatch. Shared by the localStorage loader and by server-state hydration.
 */
export function reconcile(
  parsed: LearnerState,
  content: Content,
): LearnerState {
  if (parsed.version !== STATE_VERSION) return freshState(content);
  // saves that predate the gamification layer keep everything else as-is
  if (!parsed.gamification) parsed.gamification = freshGamification();
  const fresh = freshState(content);
  for (const id of Object.keys(fresh.cards)) {
    if (!parsed.cards[id]) parsed.cards[id] = fresh.cards[id];
  }
  for (const chId of Object.keys(fresh.chapters)) {
    if (!parsed.chapters[Number(chId)])
      parsed.chapters[Number(chId)] = fresh.chapters[Number(chId)];
  }
  return parsed;
}

export function load(content: Content, sub: string): LearnerState {
  try {
    const raw = localStorage.getItem(keyFor(sub));
    if (!raw) return freshState(content);
    const parsed = JSON.parse(raw) as LearnerState;
    return reconcile(parsed, content);
  } catch {
    return freshState(content);
  }
}

export function save(state: LearnerState, sub: string): void {
  try {
    localStorage.setItem(keyFor(sub), JSON.stringify(state));
  } catch (e) {
    console.error("Failed to persist learner state", e);
  }
}

export function reset(sub: string): void {
  localStorage.removeItem(keyFor(sub));
}

export function touchStreak(
  state: LearnerState,
  now = Date.now(),
): LearnerState {
  const day = new Date(now).toISOString().slice(0, 10);
  if (state.streak.lastDay === day) return state;
  const yesterday = new Date(now - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const days = state.streak.lastDay === yesterday ? state.streak.days + 1 : 1;
  return { ...state, streak: { lastDay: day, days } };
}
