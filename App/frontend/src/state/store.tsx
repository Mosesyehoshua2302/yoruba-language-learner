import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import type { Content, Grade, LearnerState, AssessmentResult } from "../types";
import { reviewWithGrade } from "../lib/srs";
import { applyAssessment, sweepDemotions } from "../lib/gate";
import {
  applyAssessmentGamification,
  applyGradeGamification,
  applyIntroduceGamification,
  levelForXp,
  sweepBadges,
} from "../lib/gamification";
import * as storage from "../lib/storage";
import * as api from "../lib/api";
import { getContent } from "../lib/content";
import { useAuth } from "./auth";

// Content is fetched at runtime (see lib/content.ts) and loaded before render
// in main.tsx, so these are populated by initContentExports() before any
// component or the store reads them. Kept as module-level values so the ~7
// consumers can keep importing `content`/`allVocab` unchanged.
export let content: Content = undefined as unknown as Content;
export let allVocab: Extract<
  Content["chapters"][number]["items"][number],
  { type: "vocab" }
>[] = [];

/** Populate the module-level content exports. Call after loadContent(). */
export function initContentExports(): void {
  content = getContent();
  allVocab = content.chapters.flatMap((ch) =>
    ch.items.filter(
      (i): i is Extract<typeof i, { type: "vocab" }> => i.type === "vocab",
    ),
  );
}

// ---------------------------------------------------------------------------
// Celebration events (badge unlocks, level-ups) — transient UI signals, never
// persisted. Emitted from an effect after commit, so StrictMode's double
// reducer invocation cannot double-fire them.
// ---------------------------------------------------------------------------

export type CelebrationEvent =
  | { kind: "badge"; badgeId: string }
  | { kind: "level"; level: number };

type CelebrationListener = (e: CelebrationEvent) => void;
const celebrationListeners = new Set<CelebrationListener>();

export function subscribeCelebrations(fn: CelebrationListener): () => void {
  celebrationListeners.add(fn);
  return () => {
    celebrationListeners.delete(fn);
  };
}

function emitCelebration(e: CelebrationEvent) {
  for (const fn of celebrationListeners) fn(e);
}

type Action =
  | { type: "grade-card"; itemId: string; grade: Grade; now?: number }
  | { type: "introduce"; itemIds: string[]; now?: number }
  | { type: "assessment"; result: AssessmentResult }
  | { type: "sweep-demotions" }
  | { type: "reset"; sub: string }
  | { type: "hydrate"; state: LearnerState };

function withBadgeSweep(
  next: LearnerState,
  extraIds: string[] = [],
): LearnerState {
  const swept = sweepBadges(next.gamification, next, content, extraIds);
  return swept.gamification === next.gamification
    ? next
    : { ...next, gamification: swept.gamification };
}

function reducer(state: LearnerState, action: Action): LearnerState {
  switch (action.type) {
    case "grade-card": {
      const now = action.now ?? Date.now();
      const card = state.cards[action.itemId];
      if (!card) return state;
      // Grading implies the learner has now seen the item. Without this, a
      // card served from the queue's new-items slice would stay un-introduced
      // and be re-served as the same "new" card after every grade.
      let graded = reviewWithGrade(card, action.grade, now);
      let introducedToday = state.introducedToday;
      if (!card.introduced) {
        graded = { ...graded, introduced: true };
        const day = new Date(now).toISOString().slice(0, 10);
        const count = introducedToday.day === day ? introducedToday.count : 0;
        introducedToday = { day, count: count + 1 };
      }
      let next: LearnerState = {
        ...state,
        cards: { ...state.cards, [action.itemId]: graded },
        introducedToday,
      };
      next = storage.touchStreak(next, now);
      // demotion sweep after every graded review keeps the rule responsive
      const swept = sweepDemotions(next.chapters, (chId) =>
        Object.values(next.cards).filter((c) => c.chapterId === chId),
      );
      next = { ...next, chapters: swept.chapters };
      next = {
        ...next,
        gamification: applyGradeGamification(next.gamification, {
          grade: action.grade,
        }),
      };
      return withBadgeSweep(next);
    }
    case "introduce": {
      const now = action.now ?? Date.now();
      const day = new Date(now).toISOString().slice(0, 10);
      const cards = { ...state.cards };
      let count =
        state.introducedToday.day === day ? state.introducedToday.count : 0;
      let newlyIntroduced = 0;
      for (const id of action.itemIds) {
        const c = cards[id];
        if (c && !c.introduced) {
          cards[id] = { ...c, introduced: true, due: now };
          count += 1;
          newlyIntroduced += 1;
        }
      }
      let next: LearnerState = {
        ...storage.touchStreak(state, now),
        cards,
        introducedToday: { day, count },
      };
      next = {
        ...next,
        gamification: applyIntroduceGamification(
          next.gamification,
          newlyIntroduced,
        ),
      };
      return withBadgeSweep(next);
    }
    case "assessment": {
      const statusBefore = state.chapters[action.result.chapterId]?.status;
      const chapters = applyAssessment(
        state.chapters,
        action.result.chapterId,
        action.result.score,
        action.result.missedItemIds,
      );
      const statusAfter = chapters[action.result.chapterId]?.status;
      let next: LearnerState = {
        ...state,
        chapters,
        quizHistory: [...state.quizHistory, action.result],
      };
      next = {
        ...next,
        gamification: applyAssessmentGamification(next.gamification, {
          score: action.result.score,
          passed: action.result.passed,
        }),
      };
      const comeback = statusBefore === "demoted" && statusAfter === "passed";
      return withBadgeSweep(next, comeback ? ["comeback"] : []);
    }
    case "sweep-demotions": {
      const swept = sweepDemotions(state.chapters, (chId) =>
        Object.values(state.cards).filter((c) => c.chapterId === chId),
      );
      return { ...state, chapters: swept.chapters };
    }
    case "reset":
      storage.reset(action.sub);
      return storage.freshState(content);
    case "hydrate":
      return action.state;
    default:
      return state;
  }
}

const StoreCtx = createContext<{
  state: LearnerState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // StoreProvider only mounts once signed in (or in local dev, where sub is
  // "local"); namespace the cache by the user's Cognito sub.
  const { sub: authSub } = useAuth();
  const sub = authSub ?? "local";
  const [state, dispatch] = useReducer(
    reducer,
    undefined as unknown as LearnerState,
    () => storage.load(content, sub),
  );

  // Postgres (via server/) is the source of truth; localStorage is only an
  // instant-load cache. `hydrated` gates server writes until the one-time
  // fetch below resolves, so we never clobber server data with the
  // pre-hydration localStorage snapshot.
  const hydrated = useRef(false);
  useEffect(() => {
    let cancelled = false;
    api.fetchState().then((serverState) => {
      if (cancelled) return;
      if (serverState)
        dispatch({
          type: "hydrate",
          state: storage.reconcile(serverState, content),
        });
      hydrated.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    storage.save(state, sub);
    if (!hydrated.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => api.saveState(state), 600);
    return () => clearTimeout(saveTimer.current);
  }, [state, sub]);

  const prevGamification = useRef(state.gamification);
  useEffect(() => {
    const prev = prevGamification.current;
    if (prev === state.gamification) return;
    prevGamification.current = state.gamification;
    const known = new Set(prev.unlockedBadges);
    for (const id of state.gamification.unlockedBadges) {
      if (!known.has(id)) emitCelebration({ kind: "badge", badgeId: id });
    }
    const levelBefore = levelForXp(prev.xp).level;
    const levelAfter = levelForXp(state.gamification.xp).level;
    if (levelAfter > levelBefore)
      emitCelebration({ kind: "level", level: levelAfter });
  }, [state.gamification]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore outside provider");
  return ctx;
}
