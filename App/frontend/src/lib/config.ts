/**
 * Runtime configuration.
 *
 * In the cloud, the frontend CDK stack writes `config.json` into the S3 bucket
 * (see infra `CloudFrontSite.runtimeConfig`); the SPA fetches it at startup so
 * the build stays environment-agnostic. In local dev there is no `config.json`,
 * so we fall back to the local FastAPI server with auth disabled.
 */

export interface AppConfig {
  /** Base URL of the state API (no trailing slash). */
  apiUrl: string;
  /** When false, the app runs against the local dev server without tokens. */
  authEnabled: boolean;
  /** Path prefix for the state endpoints (`/api/state` local, `/state` cloud). */
  statePath: string;
  // Cognito / OIDC — present only when authEnabled.
  region?: string;
  userPoolId?: string;
  userPoolClientId?: string;
  cognitoDomain?: string;
  redirectUri?: string;
  logoutUri?: string;
}

/** Shape of the deployed config.json (all auth fields present). */
interface DeployedConfig {
  apiUrl: string;
  region: string;
  userPoolId: string;
  userPoolClientId: string;
  cognitoDomain: string;
  redirectUri: string;
  logoutUri: string;
}

const LOCAL_DEV_CONFIG: AppConfig = {
  apiUrl: 'http://localhost:8787',
  authEnabled: false,
  statePath: '/api/state',
};

let cached: AppConfig | null = null;

/**
 * Load runtime config once. Fetches `/config.json`; if it is absent or invalid
 * (local dev), returns the local-dev fallback with auth disabled.
 */
export async function loadConfig(): Promise<AppConfig> {
  if (cached) return cached;
  try {
    const res = await fetch('/config.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`config.json ${res.status}`);
    const c = (await res.json()) as Partial<DeployedConfig>;
    // A deployed config always carries the Cognito fields; if they're missing
    // treat it as dev.
    if (!c.userPoolId || !c.userPoolClientId || !c.cognitoDomain || !c.apiUrl) {
      cached = LOCAL_DEV_CONFIG;
      return cached;
    }
    cached = {
      apiUrl: c.apiUrl.replace(/\/$/, ''),
      authEnabled: true,
      statePath: '/state',
      region: c.region,
      userPoolId: c.userPoolId,
      userPoolClientId: c.userPoolClientId,
      cognitoDomain: c.cognitoDomain!.replace(/\/$/, ''),
      redirectUri: c.redirectUri,
      logoutUri: c.logoutUri,
    };
    return cached;
  } catch {
    cached = LOCAL_DEV_CONFIG;
    return cached;
  }
}

/** Synchronous accessor; throws if called before loadConfig() resolves. */
export function getConfig(): AppConfig {
  if (!cached) throw new Error('config not loaded — call loadConfig() first');
  return cached;
}

/** Test-only: reset the module cache. */
export function __resetConfigForTests(): void {
  cached = null;
}
