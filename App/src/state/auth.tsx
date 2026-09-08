import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'oidc-client-ts';
import { getConfig } from '../lib/config';
import * as auth from '../lib/auth';

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

export interface AuthValue {
  status: AuthStatus;
  /** Cognito `sub` of the signed-in user (namespaces the local cache). */
  sub: string | null;
  user: User | null;
  login: () => void;
  logout: () => void;
}

const AuthCtx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // StrictMode double-invokes effects in dev; guard so we don't run the
    // callback exchange twice.
    if (started.current) return;
    started.current = true;

    let cancelled = false;
    (async () => {
      const cfg = getConfig();

      // Local dev / auth disabled: skip the gate entirely.
      if (!cfg.authEnabled) {
        if (!cancelled) setStatus('signed-in');
        return;
      }

      try {
        // Returning from the Hosted UI redirect?
        if (auth.isCallback()) {
          const u = await auth.handleCallback();
          // Clean the ?code&state out of the URL.
          window.history.replaceState({}, document.title, window.location.pathname);
          if (!cancelled) {
            setUser(u);
            setStatus(u ? 'signed-in' : 'signed-out');
          }
          return;
        }
        // Otherwise try to restore an existing session.
        const u = await auth.restoreSession();
        if (!cancelled) {
          setUser(u);
          setStatus(u ? 'signed-in' : 'signed-out');
        }
      } catch {
        if (!cancelled) setStatus('signed-out');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      user,
      sub: user?.profile?.sub ?? (getConfig().authEnabled ? null : 'local'),
      login: () => {
        void auth.login();
      },
      logout: () => {
        void auth.logout();
      },
    }),
    [status, user],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
