import { content } from '../state/store';

function PitchMark({ kind }: { kind: 'high' | 'mid' | 'low' }) {
  const d = kind === 'high' ? 'M4 17L20 6' : kind === 'mid' ? 'M4 11.5h16' : 'M4 6l16 11';
  return (
    <svg
      viewBox="0 0 24 23"
      width={26}
      height={25}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      className="text-forest-500 dark:text-forest-400"
    >
      <path d={d} />
    </svg>
  );
}

/** Reference view for the book's Introduction (alphabet, tones, sounds). */
export function Intro() {
  return (
    <div className="space-y-5">
      <h2 className="font-display text-2xl font-semibold" lang="yo">
        {content.intro.title}
      </h2>

      <div className="card p-5">
        <h3 className="mb-3 font-display text-base font-semibold">Tone at a glance</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ToneCard word="bí" pitch="high" label="High (´)" meaning="to give birth" />
          <ToneCard word="bi" pitch="mid" label="Mid" meaning="to ask" />
          <ToneCard word="bì" pitch="low" label="Low (`)" meaning="to vomit" />
        </div>
      </div>

      <div className="card space-y-3 p-5">
        <h3 className="font-display text-base font-semibold">Notes from the Introduction</h3>
        {content.intro.notes.map((n, i) => (
          <p key={i} className="text-sm leading-relaxed text-ink-700 dark:text-ink-200" lang="yo">
            {n}
          </p>
        ))}
      </div>

      <p className="text-xs text-ink-400 dark:text-ink-600">
        From the Introduction of {content.meta.title}. This section is reference material and is not
        part of the gated progression.
      </p>
    </div>
  );
}

function ToneCard({
  word,
  pitch,
  label,
  meaning,
}: {
  word: string;
  pitch: 'high' | 'mid' | 'low';
  label: string;
  meaning: string;
}) {
  return (
    <div className="rounded-xl border border-ink-200/70 bg-ink-25 p-4 text-center transition-colors dark:border-ink-700/60 dark:bg-ink-800/40">
      <div className="flex items-center justify-center gap-3">
        <span className="font-display text-3xl font-semibold" lang="yo">
          {word}
        </span>
        <PitchMark kind={pitch} />
      </div>
      <div className="mt-2 text-xs font-medium uppercase tracking-wider text-ink-500 dark:text-ink-400">
        {label}
      </div>
      <div className="text-xs text-ink-500 dark:text-ink-400">{meaning}</div>
    </div>
  );
}
