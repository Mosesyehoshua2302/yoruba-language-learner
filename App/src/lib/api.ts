/**
 * Client for the state API. Config-driven: talks to the local FastAPI dev
 * server (no token) or the authenticated cloud API (Bearer id token), based on
 * the runtime config. Best-effort: network/server failures are logged, never
 * thrown into the UI, so the app keeps working off the localStorage cache.
 */
import type { LearnerState } from "../types";
import { getConfig } from "./config";
import { getIdToken } from "./auth";

function stateUrl(): string {
  const cfg = getConfig();
  return `${cfg.apiUrl}${cfg.statePath}`;
}

async function authHeaders(): Promise<Record<string, string>> {
  const cfg = getConfig();
  if (!cfg.authEnabled) return {};
  const token = await getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchState(): Promise<LearnerState | null> {
  try {
    const res = await fetch(stateUrl(), {
      headers: { ...(await authHeaders()) },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GET state ${res.status}`);
    const body = (await res.json()) as { state: LearnerState };
    return body.state;
  } catch (e) {
    console.warn("State server unavailable, using local cache only", e);
    return null;
  }
}

export async function saveState(state: LearnerState): Promise<void> {
  try {
    const res = await fetch(stateUrl(), {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ state }),
    });
    if (!res.ok) throw new Error(`PUT state ${res.status}`);
  } catch (e) {
    console.warn("Failed to sync state to server", e);
  }
}
