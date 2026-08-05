import { useEffect, useMemo, useState } from 'react';
import { allVocab, content, useStore } from '../state/store';
import { buildAssessment, checkTyped } from '../lib/quiz';
import { PASS_THRESHOLD } from '../lib/gate';
import {
  XP_ASSESSMENT_FAIL,
  XP_ASSESSMENT_PASS,
  XP_ASSESSMENT_SCORE_BONUS,
} from '../lib/gamification';
import { Icon } from './ui/icons';
import { ProgressRing } from './ui/ProgressRing';
import type { View } from '../App';
import type { AssessmentQuestion } from '../types';

/**
 * Chapter-gate assessment: fresh weighted sample each attempt, immediate
 * per-question feedback, results summary; >=80% passes and unlocks the next
 * chapter, otherwise missed items are surfaced for re-drilling.
 */
export function Assessment({ chapterId, setView }: { chapterId: number; setView: (v: View) => void }) {
  const { state, dispatch } = useStore();
  const chapter = content.chapters.find((c) => c.id === chapterId)!;
  const [attemptKey, setAttemptKey] = useState(0);
  const questions = useMemo(
    () =>
      buildAssessment(chapter, state.cards, state.chapters[chapterId]?.missedItemIds ?? [], allVocab),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapterId, attemptKey],
  );
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<{ q: AssessmentQuestion; given: string; correct: boolean }[]>([]);
  const [feedback, setFeedback] = useState<null | { correct: boolean; given: string }>(null);
  const [typed, setTyped] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const q = questions[idx];
  const finished = idx >= questions.length;

  // Record the result once, after the last question (not during render).
  useEffect(() => {
    if (!finished || submitted || answers.length === 0) return;
    const score = answers.filter((a) => a.correct).length / answers.length;
    const missedIds = [...new Set(answers.filter((a) => !a.correct).map((a) => a.q.itemId))];
    dispatch({
      type: 'assessment',
      result: {
        chapterId,
        timestamp: Date.now(),
        score,
        passed: score >= PASS_THRESHOLD,
        missedItemIds: missedIds,
      },
    });
    setSubmitted(true);
  }, [finished, submitted, answers, chapterId, dispatch]);

  const answer = (given: string) => {
    if (feedback) return;
    const correct =
      q.kind === 'type-en-yo' || q.kind === 'type-yo-en'
        ? checkTyped(given, q.answer)
        : given === q.answer;
    setFeedback({ correct, given });
    setAnswers((a) => [...a, { q, given, correct }]);
    // Assessments and the SRS layer share one source of truth per item:
    // every assessment answer is also an SRS review of that card.
    dispatch({ type: 'grade-card', itemId: q.itemId, grade: correct ? 'good' : 'again' });
  };

  const next = () => {
    setFeedback(null);
    setTyped('');
    setIdx((i) => i + 1);
  };

  // ---- results ----
  if (finished) {
    const score = answers.length === 0 ? 0 : answers.filter((a) => a.correct).length / answers.length;
    const passed = score >= PASS_THRESHOLD;
    const missedIds = [...new Set(answers.filter((a) => !a.correct).map((a) => a.q.itemId))];
    const xpEarned = passed
      ? XP_ASSESSMENT_PASS + Math.round(score * XP_ASSESSMENT_SCORE_BONUS)
      : XP_ASSESSMENT_FAIL;
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <div
          className={`card space-y-3 p-8 text-center ${
            passed
              ? 'border-forest-300/70 dark:border-forest-500/40'
              : 'border-gold-300/70 dark:border-gold-500/40'
          }`}
        >
          <ProgressRing
            value={score}
            size={104}
            strokeWidth={7}
            className="mx-auto"
            ringClassName={passed ? 'text-forest-500 dark:text-forest-400' : 'text-gold-500 dark:text-gold-400'}
          >
            <span className="text-2xl font-bold tabular-nums">{Math.round(score * 100)}%</span>
          </ProgressRing>
          <p
            className={`font-medium ${
              passed ? 'text-forest-700 dark:text-forest-400' : 'text-gold-700 dark:text-gold-400'
            }`}
          >
            {passed
              ? chapterId < 12
                ? `Passed! Chapter ${chapterId + 1} is unlocked.`
                : 'Passed! You have finished the book.'
              : `Below ${PASS_THRESHOLD * 100}% — stay on this chapter and drill the missed items.`}
          </p>
          <p className="text-sm text-ink-500 dark:text-ink-400">
            {answers.filter((a) => a.correct).length} of {answers.length} correct
            <span className="mx-1.5 text-ink-300 dark:text-ink-600">·</span>
            <span className="font-medium text-gold-600 dark:text-gold-400">+{xpEarned} XP</span>
          </p>
        </div>

        {missedIds.length > 0 && (
          <div className="card p-4">
            <h3 className="mb-2 text-sm font-semibold">Missed items</h3>
            <ul className="space-y-1.5 text-sm">
              {answers.filter((a) => !a.correct).map((a, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2">
                  <span lang="yo">
                    {a.q.prompt} → <span className="font-medium">{a.q.answer}</span>
                  </span>
                  <span className="text-rose-600 line-through dark:text-rose-400" lang="yo">
                    {a.given || '(blank)'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!passed && (
            <button
              className="btn-primary"
              onClick={() => {
                setIdx(0); setAnswers([]); setSubmitted(false); setAttemptKey((k) => k + 1);
              }}
            >
              Retake (fresh questions, weighted to misses)
            </button>
          )}
          <button className="btn-secondary" onClick={() => setView({ name: 'lesson', chapterId })}>
            Review chapter
          </button>
          <button className="btn-secondary" onClick={() => setView({ name: 'dashboard' })}>
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ---- question ----
  const isTyped = q.kind === 'type-en-yo' || q.kind === 'type-yo-en';
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <div className="flex justify-between text-sm text-ink-500 dark:text-ink-400">
          <span className="tabular-nums">
            Chapter {chapterId} assessment — question {idx + 1}/{questions.length}
          </span>
          <span>pass ≥ {PASS_THRESHOLD * 100}%</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
          <div
            className="h-full rounded-full bg-forest-500 transition-all duration-500 dark:bg-forest-400"
            style={{ width: `${(idx / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div key={idx} className="card animate-fade-up p-6">
        <p className="mb-2 text-xs uppercase tracking-widest text-ink-400 dark:text-ink-500">
          {q.kind === 'mc-yo-en' && 'What does this mean?'}
          {q.kind === 'mc-en-yo' && 'Choose the Yorùbá'}
          {q.kind === 'type-en-yo' && 'Type the Yorùbá (tone marks optional)'}
          {q.kind === 'type-yo-en' && 'Type the English'}
          {q.kind === 'grammar-mc' && `Grammar: ${q.context ?? ''} — what does this mean?`}
        </p>
        <p
          className="font-display text-2xl font-semibold"
          lang={q.kind === 'mc-en-yo' || q.kind === 'type-en-yo' ? 'en' : 'yo'}
        >
          {q.prompt}
        </p>

        {isTyped ? (
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => { e.preventDefault(); if (typed.trim()) answer(typed.trim()); }}
          >
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={Boolean(feedback)}
              lang={q.kind === 'type-en-yo' ? 'yo' : 'en'}
              className="flex-1 rounded-xl border border-ink-200 bg-white px-3 py-2 transition-colors focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-500/25 disabled:opacity-60 dark:border-ink-700 dark:bg-ink-900 dark:focus:border-forest-400"
              placeholder="Your answer…"
            />
            <button className="btn-primary" disabled={Boolean(feedback) || !typed.trim()}>
              Check
            </button>
          </form>
        ) : (
          <div className="mt-4 grid gap-2">
            {q.choices!.map((c) => {
              const chosen = feedback?.given === c;
              const isAnswer = c === q.answer;
              return (
                <button
                  key={c}
                  onClick={() => answer(c)}
                  disabled={Boolean(feedback)}
                  lang="yo"
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                    feedback
                      ? isAnswer
                        ? 'border-forest-400 bg-forest-50 dark:border-forest-500/60 dark:bg-forest-500/10'
                        : chosen
                          ? 'border-rose-300 bg-rose-50 dark:border-rose-500/50 dark:bg-rose-500/10'
                          : 'border-ink-200 opacity-50 dark:border-ink-700'
                      : 'border-ink-200 hover:border-forest-400 hover:bg-forest-50 dark:border-ink-700 dark:hover:border-forest-500/60 dark:hover:bg-forest-500/10'
                  }`}
                >
                  {c}
                  {feedback && isAnswer && (
                    <Icon name="check" size={16} className="shrink-0 text-forest-600 dark:text-forest-400" />
                  )}
                  {feedback && chosen && !isAnswer && (
                    <Icon name="x" size={16} className="shrink-0 text-rose-500 dark:text-rose-400" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {feedback && (
          <div
            className={`mt-4 flex items-center gap-1.5 text-sm font-medium ${
              feedback.correct
                ? 'text-forest-700 dark:text-forest-400'
                : 'text-rose-700 dark:text-rose-400'
            }`}
          >
            <Icon name={feedback.correct ? 'check' : 'x'} size={15} />
            {feedback.correct ? (
              'Correct!'
            ) : (
              <span>
                Not quite — the answer is{' '}
                <span lang="yo" className="font-bold">
                  {q.answer}
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      {feedback && (
        <button className="btn-primary w-full py-3" onClick={next}>
          {idx + 1 < questions.length ? 'Next question' : 'See results'}
        </button>
      )}
    </div>
  );
}
