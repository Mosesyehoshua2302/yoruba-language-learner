/**
 * Auth via Cognito Hosted UI (OAuth2 authorization code + PKCE), using
 * `oidc-client-ts`. This wraps a single `UserManager` configured from the
 * runtime config. When auth is disabled (local dev) all calls are no-ops and
 * `getIdToken()` returns null, so the rest of the app can stay auth-agnostic.
 */
import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';
import { getConfig } from './config';

let manager: UserManager | null = null;

function getManager(): UserManager | null {
  const cfg = getConfig();
  if (!cfg.authEnabled) return null;
  if (manager) return manager;
  manager = new UserManager({
    // Cognito's OIDC issuer for a user pool.
    authority: `https://cognito-idp.${cfg.region}.amazonaws.com/${cfg.userPoolId}`,
    // Cognito requires the Hosted UI domain for the authorize/logout endpoints;
    // provide explicit metadata so discovery targets the Hosted UI.
    metadata: {
      issuer: `https://cognito-idp.${cfg.region}.amazonaws.com/${cfg.userPoolId}`,
      authorization_endpoint: `${cfg.cognitoDomain}/oauth2/authorize`,
      token_endpoint: `${cfg.cognitoDomain}/oauth2/token`,
      userinfo_endpoint: `${cfg.cognitoDomain}/oauth2/userInfo`,
      end_session_endpoint: `${cfg.cognitoDomain}/logout`,
      jwks_uri: `https://cognito-idp.${cfg.region}.amazonaws.com/${cfg.userPoolId}/.well-known/jwks.json`,
    },
    client_id: cfg.userPoolClientId!,
    redirect_uri: cfg.redirectUri!,
    post_logout_redirect_uri: cfg.logoutUri!,
    response_type: 'code',
    scope: 'openid email profile',
    // Tokens in localStorage so a returning user keeps their session.
    userStore: new WebStorageStateStore({ store: window.localStorage }),
    automaticSilentRenew: true,
  });
  return manager;
}

/** Redirect to the Hosted UI to begin sign-in (PKCE handled by the library). */
export async function login(): Promise<void> {
  const m = getManager();
  if (!m) return;
  await m.signinRedirect();
}

/**
 * Complete the redirect callback: exchange the authorization code for tokens.
 * Returns the signed-in user, or null when auth is disabled.
 */
export async function handleCallback(): Promise<User | null> {
  const m = getManager();
  if (!m) return null;
  return m.signinRedirectCallback();
}

/** Restore an existing session on load (silent), or null if none/expired. */
export async function restoreSession(): Promise<User | null> {
  const m = getManager();
  if (!m) return null;
  const user = await m.getUser();
  if (user && !user.expired) return user;
  // Try a silent renew if we have a refresh token.
  try {
    return await m.signinSilent();
  } catch {
    return null;
  }
}

/** Current id token, auto-refreshing if expired. Null when auth is disabled. */
export async function getIdToken(): Promise<string | null> {
  const m = getManager();
  if (!m) return null;
  let user = await m.getUser();
  if (user && user.expired) {
    try {
      user = await m.signinSilent();
    } catch {
      return null;
    }
  }
  return user?.id_token ?? null;
}

/** Sign out locally and redirect to the Cognito logout endpoint. */
export async function logout(): Promise<void> {
  const m = getManager();
  if (!m) return;
  await m.signoutRedirect();
}

/** True when the current URL is an OAuth redirect callback (has ?code=&state=). */
export function isCallback(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has('code') && params.has('state');
}

/** Test-only: drop the cached UserManager. */
export function __resetAuthForTests(): void {
  manager = null;
}
