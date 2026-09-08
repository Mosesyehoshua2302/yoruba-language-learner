import { useAuth } from '../../state/auth';

/**
 * The hard gate. Shown while signed out — credentials are collected on the
 * Cognito Hosted UI, so this is just a themed landing that starts the redirect.
 */
export function AuthScreen() {
  const { login } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <h1 lang="yo" className="font-display text-3xl font-semibold tracking-tight">
          Yorùbá Yé Mi
        </h1>
        <p className="mt-3 text-sm text-ink-500 dark:text-ink-400">
          Sign in to start learning and sync your progress across devices.
        </p>
        <button
          onClick={login}
          className="mt-8 w-full rounded-lg bg-forest-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-forest-700 dark:bg-forest-500 dark:hover:bg-forest-400"
        >
          Sign in
        </button>
      </div>
    </div>
  );
}

/** Neutral splash shown while the session is being restored. */
export function AuthSplash() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <span
        lang="yo"
        className="font-display text-2xl font-semibold tracking-tight text-ink-400 dark:text-ink-600"
      >
        Yorùbá Yé Mi
      </span>
    </div>
  );
}
