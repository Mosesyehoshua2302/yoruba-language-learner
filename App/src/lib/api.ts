/**
 * Client for the local Postgres-backed state server (server/index.ts).
 * Called directly by absolute URL rather than via a Vite dev-server proxy:
 * the server already sends permissive CORS headers, dev/preview/prod all
 * work the same way, and it's independent of whatever port Vite lands on.
 * Best-effort: network/server failures are logged, never thrown into the UI,
 * so the app keeps working off the localStorage cache when the server is down.
 */
import type { LearnerState } from '../types';

const API_BASE = 'http://localhost:8787';

export async function fetchState(): Promise<LearnerState | null> {
  try {
    const res = await fetch(`${API_BASE}/api/state`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GET /api/state ${res.status}`);
    const body = (await res.json()) as { state: LearnerState };
    return body.state;
  } catch (e) {
    console.warn('State server unavailable, using local cache only', e);
    return null;
  }
}

export async function saveState(state: LearnerState): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
    });
    if (!res.ok) throw new Error(`PUT /api/state ${res.status}`);
  } catch (e) {
    console.warn('Failed to sync state to server', e);
  }
}
