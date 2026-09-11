// ---------- Content (from content.json — the single source of truth) ----------

export interface VocabItem {
  id: string;
  type: "vocab";
  pos: string;
  yo: string;
  en: string;
}

export interface GrammarItem {
  id: string;
  type: "grammar";
  lesson: number;
  title: string;
  explanation: string;
  examples: { yo: string; en: string }[];
}

export type ContentItem = VocabItem | GrammarItem;

export interface Chapter {
  id: number;
  yorubaTitle: string;
  title: string;
  objectives: string[];
  items: ContentItem[];
}

export interface Content {
  meta: {
    title: string;
    author: string;
    license: string;
    isbn: string;
    extractionNotes: string[];
  };
  intro: { title: string; notes: string[] };
  chapters: Chapter[];
}

// ---------- Learner state ----------

/** SM-2 scheduling state for one item. */
export interface SrsCard {
  itemId: string;
  chapterId: number;
  ease: number; // SM-2 ease factor (min 1.3)
  interval: number; // days
  reps: number; // consecutive successful repetitions
  lapses: number; // times failed after having been learned
  due: number; // epoch ms when next due
  introduced: boolean; // has the learner seen it in a lesson?
  /** rolling window of recent review results (true = correct), newest last */
  history: boolean[];
}

export type ChapterStatus = "locked" | "active" | "passed" | "demoted";

export interface AssessmentQuestion {
  itemId: string;
  kind: "mc-yo-en" | "mc-en-yo" | "type-en-yo" | "type-yo-en" | "grammar-mc";
  prompt: string;
  choices?: string[]; // for multiple choice
  answer: string;
  context?: string; // e.g. grammar lesson title
}

export interface AssessmentResult {
  chapterId: number;
  timestamp: number;
  score: number; // fraction correct 0..1
  passed: boolean;
  missedItemIds: string[];
}

export interface ChapterProgress {
  chapterId: number;
  status: ChapterStatus;
  attempts: number;
  missedItemIds: string[]; // from the most recent failed attempt, drives re-drilling
}

/** Engagement layer, additive to the SRS/gate progression — never gates content. */
export interface GamificationState {
  xp: number;
  totalReviews: number;
  currentReviewStreak: number;
  bestReviewStreak: number;
  /** Badge ids, permanent once earned even if underlying stats later dip. */
  unlockedBadges: string[];
}

export interface LearnerState {
  version: number;
  cards: Record<string, SrsCard>;
  chapters: Record<number, ChapterProgress>;
  quizHistory: AssessmentResult[];
  streak: { lastDay: string; days: number };
  newPerDay: number;
  introducedToday: { day: string; count: number };
  gamification: GamificationState;
}

/** Grades used by the review UI, mapped onto SM-2's 0–5 quality scale. */
export type Grade = "again" | "hard" | "good" | "easy";

// ---------- Sentence bank (from sentences.json) ----------

export interface SentenceItem {
  id: string;
  yo: string;
  en: string;
  page: number;
}

export interface SentenceCategory {
  id: string;
  label: string;
  items: SentenceItem[];
}

export interface VocabPair {
  yo: string;
  en: string;
}

export interface OppositePair extends VocabPair {
  opposite: VocabPair;
}

export interface SentencesData {
  meta: {
    title: string;
    note: string;
    confidence: string;
    caveat: string;
    sourceFile: string;
  };
  categories: SentenceCategory[];
  vocab: {
    numbers: VocabPair[];
    colors: VocabPair[];
    opposites: OppositePair[];
  };
}
