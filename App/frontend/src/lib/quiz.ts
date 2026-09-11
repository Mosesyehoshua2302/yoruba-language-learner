/**
 * Question generation for chapter-gate assessments and drills.
 * Questions are generated from the chapter's SRS items (shared source of
 * truth), weighted toward previously missed / weak items, with a fresh
 * random sample each attempt.
 */
import type {
  AssessmentQuestion,
  Chapter,
  ContentItem,
  GrammarItem,
  SrsCard,
  VocabItem,
} from '../types';

const ASSESSMENT_SIZE = 12;

function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickWeighted<T>(
  pool: { item: T; weight: number }[],
  n: number,
  rand: () => number = Math.random,
): T[] {
  const out: T[] = [];
  const p = [...pool];
  while (out.length < n && p.length > 0) {
    const total = p.reduce((s, e) => s + e.weight, 0);
    let r = rand() * total;
    let idx = 0;
    for (let i = 0; i < p.length; i++) {
      r -= p[i].weight;
      if (r <= 0) { idx = i; break; }
    }
    out.push(p[idx].item);
    p.splice(idx, 1);
  }
  return out;
}

/** Distractors: same chapter first (preferring same POS), then anywhere. */
function distractors(
  correct: VocabItem,
  chapterItems: ContentItem[],
  allVocab: VocabItem[],
  field: 'yo' | 'en',
  n = 3,
): string[] {
  const sameCh = chapterItems.filter(
    (i): i is VocabItem => i.type === 'vocab' && i.id !== correct.id && i[field] !== correct[field],
  );
  const samePos = sameCh.filter((i) => i.pos === correct.pos);
  const pool = samePos.length >= n ? samePos : sameCh;
  const extra = allVocab.filter((i) => i.id !== correct.id && i[field] !== correct[field]);
  const chosen: string[] = [];
  for (const src of [shuffle(pool), shuffle(extra)]) {
    for (const it of src) {
      if (chosen.length >= n) break;
      if (!chosen.includes(it[field])) chosen.push(it[field]);
    }
  }
  return chosen.slice(0, n);
}

function vocabQuestion(
  item: VocabItem,
  chapter: Chapter,
  allVocab: VocabItem[],
  kindIdx: number,
): AssessmentQuestion {
  const kinds: AssessmentQuestion['kind'][] = ['mc-yo-en', 'mc-en-yo', 'type-en-yo', 'mc-yo-en'];
  const kind = kinds[kindIdx % kinds.length];
  if (kind === 'mc-yo-en') {
    return {
      itemId: item.id, kind,
      prompt: item.yo,
      choices: shuffle([item.en, ...distractors(item, chapter.items, allVocab, 'en')]),
      answer: item.en,
    };
  }
  if (kind === 'mc-en-yo') {
    return {
      itemId: item.id, kind,
      prompt: item.en,
      choices: shuffle([item.yo, ...distractors(item, chapter.items, allVocab, 'yo')]),
      answer: item.yo,
    };
  }
  // typed English -> Yorùbá
  return { itemId: item.id, kind: 'type-en-yo', prompt: item.en, answer: item.yo };
}

function grammarQuestion(item: GrammarItem, chapter: Chapter): AssessmentQuestion | null {
  if (item.examples.length === 0) return null;
  const ex = item.examples[Math.floor(Math.random() * item.examples.length)];
  const others = chapter.items
    .filter((i): i is GrammarItem => i.type === 'grammar' && i.id !== item.id)
    .flatMap((g) => g.examples.map((e) => e.en))
    .filter((en) => en !== ex.en);
  const distr = shuffle([...new Set(others)]).slice(0, 3);
  if (distr.length < 2) {
    // not enough material for MC — fall back to a typed translation
    return { itemId: item.id, kind: 'type-yo-en', prompt: ex.yo, answer: ex.en, context: item.title };
  }
  return {
    itemId: item.id, kind: 'grammar-mc',
    prompt: ex.yo,
    choices: shuffle([ex.en, ...distr]),
    answer: ex.en,
    context: item.title,
  };
}

/**
 * Build a chapter-gate assessment: a weighted fresh sample of the chapter's
 * items. Weights: missed on last attempt ×4, lapsed/weak cards ×2 (+1 per
 * lapse), everything else ×1.
 */
export function buildAssessment(
  chapter: Chapter,
  cards: Record<string, SrsCard>,
  missedItemIds: string[],
  allVocab: VocabItem[],
  size = ASSESSMENT_SIZE,
): AssessmentQuestion[] {
  const missed = new Set(missedItemIds);
  const pool = chapter.items.map((item) => {
    const card = cards[item.id];
    let weight = 1;
    if (missed.has(item.id)) weight += 3;
    if (card) {
      weight += Math.min(3, card.lapses);
      const recent = card.history.slice(-5);
      const wrong = recent.filter((r) => !r).length;
      weight += wrong;
    }
    return { item, weight };
  });

  const n = Math.min(size, pool.length);
  const chosen = pickWeighted(pool, n);
  const questions: AssessmentQuestion[] = [];
  chosen.forEach((item, i) => {
    if (item.type === 'vocab') {
      questions.push(vocabQuestion(item, chapter, allVocab, i));
    } else {
      const q = grammarQuestion(item, chapter);
      if (q) questions.push(q);
    }
  });
  return shuffle(questions);
}

/** A short drill over specific items (used for re-drilling missed items). */
export function buildDrill(
  chapter: Chapter,
  itemIds: string[],
  allVocab: VocabItem[],
): AssessmentQuestion[] {
  const items = chapter.items.filter((i) => itemIds.includes(i.id));
  const qs: AssessmentQuestion[] = [];
  items.forEach((item, i) => {
    if (item.type === 'vocab') qs.push(vocabQuestion(item, chapter, allVocab, i));
    else {
      const q = grammarQuestion(item, chapter);
      if (q) qs.push(q);
    }
  });
  return shuffle(qs);
}

/**
 * Diacritic-tolerant answer checking for typed questions: exact match
 * scores full; a match ignoring tone marks / under-dots is also accepted
 * (typing Yorùbá diacritics on a QWERTY keyboard is genuinely hard).
 */
export function checkTyped(answer: string, expected: string): boolean {
  const norm = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[.,!?'’‘"”“]/g, '').replace(/\s+/g, ' ').trim();
  if (norm(answer) === norm(expected)) return true;
  // allow any one of several slash/paren-separated variants
  const variants = expected.split(/[/(]/).map((v) => norm(v.replace(/\)/g, '')));
  return variants.some((v) => v.length > 0 && norm(answer) === v);
}
