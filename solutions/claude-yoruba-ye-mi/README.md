# Yorùbá Yé Mi — Language Learning App

A local-first web app for learning Yorùbá, built entirely from the open textbook
**Yorùbá Yé Mi** (Fẹ̀hìntọ́lá Mosádomi, COERLL / University of Texas at Austin, 2012, CC-licensed).
All content lives in `src/data/content.json` — 12 chapters, 1,008 vocabulary items and 47
grammar lessons extracted from the book.

## Run it

```bash
npm install
npm run dev      # development server
npm run build    # production build (output in dist/)
npm test         # unit tests for the SRS + chapter-gate modules
```

Requires Node 18+. After the initial load the app is fully offline: no backend, no external
API calls. All learner state persists in `localStorage` (a backend would add nothing for a
single-learner app; state is well under localStorage's size limits).

To host it on AWS (S3/CloudFront frontend + Cognito/API Gateway/Lambda/DynamoDB
state-sync backend), see [`infra/README.md`](infra/README.md) — TypeScript CDK,
deployed with `cdk deploy --all`.

## How the two progression layers work

**Layer A — chapter gates (macro).** The book's 12 chapters are sequential levels. Each
chapter has an assessment of ~12 mixed questions (multiple choice Yorùbá→English and
English→Yorùbá, typed translation, grammar comprehension). Passing at **≥ 80%** unlocks the
next chapter. Failing keeps you on the chapter, marks the missed items in the lesson view,
and the retake draws a **fresh weighted sample** (missed items ×4 weight, lapsed SRS cards
weighted up too — never the same quiz verbatim).

**Layer B — spaced repetition (micro).** Every vocab/grammar item is an SM-2 card
(`src/lib/srs.ts`): ease factor, interval, repetition count and due date per item. Review
grades (Again/Hard/Good/Easy → SM-2 quality 1/3/4/5) update the schedule; a failed card
resets its interval (standard SM-2 lapse) and resurfaces within ~10 minutes. The daily
queue mixes due cards from **all unlocked chapters** with up to 10 new items/day from the
current chapter.

**How they interact (one source of truth).** Chapter assessments draw their questions from
the chapter's SRS cards, and every assessment answer is *also* recorded as an SRS review of
that card — there are no disconnected quiz banks. Each card keeps a rolling window of its
last 20 results; if a **passed** chapter's rolling accuracy drops below **60%** (minimum 10
recent samples), the chapter is **demoted**: it reopens as active practice, its cards jump
to the front of the queue, and *all forward progress is blocked* until its assessment is
re-passed. The demotion sweep runs after every graded review (`src/lib/gate.ts`).

## Code layout

```
src/data/content.json    all book content (single source of truth)
src/lib/srs.ts           SM-2 scheduler (pure functions)
src/lib/gate.ts          chapter gates, pass/fail, demotion sweep
src/lib/queue.ts         daily review-queue builder
src/lib/quiz.ts          assessment/drill question generation
src/lib/storage.ts       localStorage persistence (versioned)
src/lib/__tests__/       unit tests (vitest; also run standalone via tsx)
src/state/store.tsx      React context + reducer wiring the modules to the UI
src/components/          Dashboard, Syllabus, Lesson, Review, Assessment, Intro
scripts/                 the PDF-extraction pipeline that produced content.json
```

Logic modules are UI-free and individually testable; the UI only dispatches actions.

## Editing / correcting content

Fix any extraction error directly in `src/data/content.json`:

- Vocab item: `{"id":"c3-v12","type":"vocab","pos":"noun","yo":"ọjà","en":"market"}` —
  edit `yo`/`en`/`pos` freely; keep the `id` stable so learner progress attaches to it.
- Grammar item: edit `explanation` or the `examples` array (`{"yo":…,"en":…}`).
- Adding items: use a fresh unique `id` (e.g. `c3-v99`); the app creates an SRS card for it
  automatically on next load without disturbing existing progress.

To re-run extraction from the PDF: `scripts/extract_content.py` (positional two-column
parsing with pdfplumber) → `scripts/build_content.py` (assembles content.json). Adjust the
PDF path at the top of the scripts. `scripts/decode.py` holds the legacy-font character map.

## Extraction notes & flags

The full notes are in `content.json → meta.extractionNotes`. Summary:

1. **Legacy font encoding.** The PDF's "YorubaSans" font has no Unicode mapping — ọ/ẹ/ṣ and
   tone-marked vowels extract as æ/÷/«/ô etc. The mapping was derived empirically
   (e.g. `Àwæn örö → Àwọn ọ̀rọ̀`) and spot-checked in every chapter. Isolated mis-decodes may
   remain; they're one-line fixes in content.json.
2. **Grammar explanations** are concise summaries written from each lesson (the book's prose
   doesn't survive PDF extraction cleanly); example sentences are verbatim from the book's
   two-column example tables. Dialogue/exercise-heavy lessons (parts of ch. 7–9 and 12)
   yielded few machine-extractable example pairs, so those grammar cards lean on the
   explanation text.
3. **Dialogues and in-book exercises** were not separately structured; the app generates its
   own drills from the shared item pool instead.
4. **No audio**: the book bundles none (COERLL hosts audio online), and the app is
   offline-first, so listening drills are omitted. Question types are the text-based subset.

## Tuning decisions (deviations proposed, not silently made)

- **80% pass / 60% demotion thresholds kept as specified.** They fit the data: with ~12
  questions per assessment, 80% = at most 2 misses; 60% rolling accuracy over ≥10 samples
  is comfortably below normal SRS accuracy (~90%), so demotion only fires on real decay.
- **New-item cap of 10/day (adjustable in state).** Chapters 7–9 and 12 carry 100–160 vocab
  items each — far denser than ch. 1–6. Without a cap, "learn the chapter" dumps 150 cards
  into day one and the review queue collapses. This is the one addition I'd flag: consider
  raising it to 15–20 once you're past chapter 6, at the cost of heavier review days.
- **Typed answers accept tone-markless input** (e.g. `e kaaaro` for `Ẹ káàárọ̀`) since typing
  Yorùbá diacritics on a standard keyboard is impractical; multiple-choice questions still
  require distinguishing full orthography.

## License

App code: MIT. Textbook content: Creative Commons, © 2012 COERLL, The University of Texas
at Austin (ISBN 978-1937963-02-6).
