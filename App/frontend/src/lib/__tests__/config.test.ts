import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, __resetConfigForTests } from '../config';

const DEPLOYED = {
  apiUrl: 'https://api.example.com/',
  region: 'us-east-1',
  userPoolId: 'us-east-1_abc',
  userPoolClientId: 'client123',
  cognitoDomain: 'https://pool.auth.us-east-1.amazoncognito.com/',
  redirectUri: 'https://app.example.com/callback',
  logoutUri: 'https://app.example.com/',
};

function mockFetch(res: { ok: boolean; status?: number; json?: () => Promise<unknown> }) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: res.ok,
    status: res.status ?? (res.ok ? 200 : 500),
    json: res.json ?? (async () => ({})),
  }));
}

describe('loadConfig', () => {
  beforeEach(() => __resetConfigForTests());
  afterEach(() => vi.unstubAllGlobals());

  it('parses a deployed config and enables auth', async () => {
    mockFetch({ ok: true, json: async () => DEPLOYED });
    const cfg = await loadConfig();
    expect(cfg.authEnabled).toBe(true);
    expect(cfg.statePath).toBe('/state');
    // trailing slashes trimmed
    expect(cfg.apiUrl).toBe('https://api.example.com');
    expect(cfg.cognitoDomain).toBe('https://pool.auth.us-east-1.amazoncognito.com');
    expect(cfg.userPoolClientId).toBe('client123');
  });

  it('falls back to local dev (auth disabled) when config.json is missing', async () => {
    mockFetch({ ok: false, status: 404 });
    const cfg = await loadConfig();
    expect(cfg.authEnabled).toBe(false);
    expect(cfg.apiUrl).toBe('http://localhost:8787');
    expect(cfg.statePath).toBe('/api/state');
  });

  it('treats a config missing Cognito fields as local dev', async () => {
    mockFetch({ ok: true, json: async () => ({ apiUrl: 'https://x' }) });
    const cfg = await loadConfig();
    expect(cfg.authEnabled).toBe(false);
  });
});
