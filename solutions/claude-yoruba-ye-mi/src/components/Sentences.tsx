import { useState } from 'react';
import sentencesJson from '../data/sentences.json';
import { Icon } from './ui/icons';

interface SentenceItem {
  id: string;
  yo: string;
  en: string;
  page: number;
}

interface SentenceCategory {
  id: string;
  label: string;
  items: SentenceItem[];
}

interface VocabPair {
  yo: string;
  en: string;
}

interface OppositePair extends VocabPair {
  opposite: VocabPair;
}

interface SentencesData {
  meta: { title: string; note: string; confidence: string; caveat: string; sourceFile: string };
  categories: SentenceCategory[];
  vocab: { numbers: VocabPair[]; colors: VocabPair[]; opposites: OppositePair[] };
}

const sentences = sentencesJson as SentencesData;

/**
 * Reference-only phrasebook from a different, lower-confidence source (an
 * informal, un-tone-marked 2018 language-tape script). Deliberately outside
 * the SRS/chapter-gate system: no cards, no chapter stats, no persisted
 * state. The "practiced" checkmark below is local component state only —
 * it resets the moment the learner navigates away.
 */
export function Sentences() {
  const [activeCat, setActiveCat] = useState(sentences.categories[0]?.id ?? '');
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [practiced, setPracticed] = useState<Set<string>>(new Set());

  const category = sentences.categories.find((c) => c.id === activeCat) ?? sentences.categories[0];

  const toggleFlip = (id: string) => {
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPracticed((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  };

  return (
    <div className="space-y-6">
      <div className="card flex gap-3 border-gold-300/70 bg-gold-50/70 p-4 dark:border-gold-500/30 dark:bg-gold-900/15">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-400/20 text-gold-700 dark:text-gold-300">
          <Icon name="sparkle" size={16} />
        </span>
        <div className="min-w-0 text-sm text-gold-900/90 dark:text-gold-100/85">
          <p className="font-semibold text-gold-800 dark:text-gold-300">Informal phrasebook — unverified</p>
          <p className="mt-1 leading-relaxed">{sentences.meta.caveat}</p>
        </div>
      </div>

      <div className="-mx-1 flex items-center gap-1 overflow-x-auto border-b border-ink-200/70 px-1 dark:border-ink-800/70">
        {sentences.categories.map((c) => (
          <CategoryTab
            key={c.id}
            label={c.label}
            active={c.id === category?.id}
            onClick={() => setActiveCat(c.id)}
          />
        ))}
      </div>

      {category && (
        <div key={category.id} className="view-transition grid grid-cols-1 gap-3 sm:grid-cols-2">
          {category.items.map((item) => {
            const isFlipped = flipped.has(item.id);
            const isPracticed = practiced.has(item.id);
            return (
              <div key={item.id} className="relative">
                <button
                  type="button"
                  onClick={() => toggleFlip(item.id)}
                  aria-pressed={isFlipped}
                  className="flip-scene block h-36 w-full rounded-2xl text-left"
                >
                  <div className={`flip-card h-full ${isFlipped ? 'is-flipped' : ''}`}>
                    <div className="flip-face card flex h-full flex-col items-center justify-center gap-1 p-4 text-center">
                      <p lang="yo" className="font-display text-lg font-semibold">
                        {item.yo}
                      </p>
                      <p className="text-[11px] text-ink-400 dark:text-ink-500">tap to reveal · p.{item.page}</p>
                    </div>
                    <div className="flip-face flip-face-back card flex h-full flex-col items-center justify-center gap-1 p-4 text-center">
                      <p className="text-base font-medium">{item.en}</p>
                      <p lang="yo" className="text-xs text-ink-400 dark:text-ink-500">
                        {item.yo}
                      </p>
                    </div>
                  </div>
                </button>
                {isPracticed && (
                  <span className="motion-safe:animate-pop-in absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-forest-600 text-white shadow-soft dark:bg-forest-500">
                    <Icon name="check" size={13} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <VocabPillSection title="Numbers" items={sentences.vocab.numbers} />
        <VocabPillSection title="Colors" items={sentences.vocab.colors} />
        <OppositesSection items={sentences.vocab.opposites} />
      </div>

      <p className="text-xs text-ink-400 dark:text-ink-600">
        Source: {sentences.meta.title} ({sentences.meta.note}). Reference only — not part of the gated
        progression or spaced-review system.
      </p>
    </div>
  );
}

function CategoryTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative shrink-0 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'text-ink-900 dark:text-ink-50'
          : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100'
      }`}
    >
      {label}
      <span
        className={`absolute inset-x-2.5 -bottom-px h-0.5 rounded-full bg-forest-600 transition-transform duration-300 dark:bg-forest-400 ${
          active ? 'scale-x-100' : 'scale-x-0'
        }`}
      />
    </button>
  );
}

function VocabPillSection({ title, items }: { title: string; items: VocabPair[] }) {
  return (
    <div className="card p-4">
      <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
        {title}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((v, i) => (
          <span
            key={i}
            className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-700 dark:bg-ink-800 dark:text-ink-200"
          >
            <span lang="yo">{v.yo}</span>
            <span className="text-ink-400 dark:text-ink-500"> · {v.en}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function OppositesSection({ items }: { items: OppositePair[] }) {
  return (
    <div className="card p-4 sm:col-span-1">
      <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
        Opposites
      </h3>
      <div className="space-y-1.5">
        {items.map((v, i) => (
          <div key={i} className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-full bg-ink-100 px-2.5 py-1 font-medium text-ink-700 dark:bg-ink-800 dark:text-ink-200">
              <span lang="yo">{v.yo}</span> <span className="text-ink-400 dark:text-ink-500">({v.en})</span>
            </span>
            <Icon name="arrow-right" size={12} className="shrink-0 text-ink-300 dark:text-ink-600" />
            <span className="rounded-full bg-ink-100 px-2.5 py-1 font-medium text-ink-700 dark:bg-ink-800 dark:text-ink-200">
              <span lang="yo">{v.opposite.yo}</span>{' '}
              <span className="text-ink-400 dark:text-ink-500">({v.opposite.en})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
