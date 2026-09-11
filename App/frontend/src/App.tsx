import { useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { Syllabus } from "./components/Syllabus";
import { Lesson } from "./components/Lesson";
import { Review } from "./components/Review";
import { Assessment } from "./components/Assessment";
import { Intro } from "./components/Intro";
import { Sentences } from "./components/Sentences";
import { useStore, content } from "./state/store";
import { currentChapterId } from "./lib/gate";
import { dueCounts } from "./lib/queue";
import { levelForXp } from "./lib/gamification";
import { Icon } from "./components/ui/icons";
import { ProgressRing } from "./components/ui/ProgressRing";
import { ThemeToggle } from "./components/ui/ThemeToggle";
import { Celebrations } from "./components/ui/Celebrations";
import { useAuth } from "./state/auth";
import { getConfig } from "./lib/config";

export type View =
  | { name: "dashboard" }
  | { name: "syllabus" }
  | { name: "intro" }
  | { name: "lesson"; chapterId: number }
  | { name: "review" }
  | { name: "assessment"; chapterId: number }
  | { name: "sentences" };

export default function App() {
  const { state } = useStore();
  const { logout } = useAuth();
  const authEnabled = getConfig().authEnabled;
  const [view, setView] = useState<View>({ name: "dashboard" });
  const current = currentChapterId(state.chapters);
  const due = dueCounts(state).total;
  const level = levelForXp(state.gamification.xp);
  const today = new Date().toISOString().slice(0, 10);
  const studiedToday = state.streak.lastDay === today;

  const tab = (v: View, label: string, badge?: number) => {
    const active = view.name === v.name;
    return (
      <button
        onClick={() => setView(v)}
        className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors ${
          active
            ? "text-ink-900 dark:text-ink-50"
            : "text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100"
        }`}
      >
        {label}
        {badge ? (
          <span className="rounded-full bg-gold-400/25 px-1.5 py-px text-[11px] font-semibold tabular-nums text-gold-700 dark:bg-gold-400/15 dark:text-gold-300">
            {badge}
          </span>
        ) : null}
        <span
          className={`absolute inset-x-2.5 -bottom-px h-0.5 rounded-full bg-forest-600 transition-transform duration-300 dark:bg-forest-400 ${
            active ? "scale-x-100" : "scale-x-0"
          }`}
        />
      </button>
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-ink-50/85 backdrop-blur-md transition-colors dark:border-ink-800/80 dark:bg-ink-950/85">
        <div className="mx-auto max-w-4xl px-4">
          <div className="flex items-center gap-3 pt-2.5">
            <h1
              lang="yo"
              className="font-display text-xl font-semibold tracking-tight"
            >
              Yorùbá Yé Mi
            </h1>
            <div className="ml-auto flex items-center gap-2.5">
              <div
                className="flex items-center gap-1.5"
                title={`Level ${level.level} · ${level.xpTotal} XP · ${level.xpIntoLevel}/${level.xpForNextLevel} into this level`}
              >
                <ProgressRing
                  value={level.xpIntoLevel / level.xpForNextLevel}
                  size={30}
                  strokeWidth={3}
                >
                  <span className="text-[11px] font-bold tabular-nums">
                    {level.level}
                  </span>
                </ProgressRing>
                <span className="hidden text-xs font-medium text-ink-500 dark:text-ink-400 md:block">
                  {level.title}
                </span>
              </div>
              <div
                className={`flex items-center gap-1 ${
                  studiedToday
                    ? "text-gold-600 dark:text-gold-400"
                    : "text-ink-300 dark:text-ink-600"
                }`}
                title={
                  studiedToday
                    ? `${state.streak.days}-day streak — you studied today`
                    : `${state.streak.days}-day streak — nothing studied yet today`
                }
              >
                <Icon name="flame" size={17} />
                <span className="text-sm font-semibold tabular-nums">
                  {state.streak.days}
                </span>
              </div>
              <ThemeToggle />
              {authEnabled && (
                <button
                  onClick={logout}
                  title="Sign out"
                  className="text-ink-500 transition-colors hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100"
                >
                  <Icon name="logout" size={17} />
                </button>
              )}
            </div>
          </div>
          <nav className="-mx-3 flex items-center overflow-x-auto px-1">
            {tab({ name: "dashboard" }, "Dashboard")}
            {tab({ name: "lesson", chapterId: current }, "Learn")}
            {tab({ name: "review" }, "Review", due)}
            {tab({ name: "syllabus" }, "Syllabus")}
            {tab({ name: "sentences" }, "Sentences")}
            {tab({ name: "intro" }, "Sounds")}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        <div key={view.name} className="view-transition">
          {view.name === "dashboard" && <Dashboard setView={setView} />}
          {view.name === "syllabus" && <Syllabus setView={setView} />}
          {view.name === "intro" && <Intro />}
          {view.name === "lesson" && (
            <Lesson chapterId={view.chapterId} setView={setView} />
          )}
          {view.name === "review" && <Review setView={setView} />}
          {view.name === "assessment" && (
            <Assessment chapterId={view.chapterId} setView={setView} />
          )}
          {view.name === "sentences" && <Sentences />}
        </div>
      </main>
      <footer className="mx-auto w-full max-w-4xl px-4 pb-8 text-xs text-ink-400 dark:text-ink-600">
        Content: {content.meta.title} — {content.meta.author} (
        {content.meta.license})
      </footer>
      <Celebrations />
    </div>
  );
}
