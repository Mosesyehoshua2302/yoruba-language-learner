import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock config + auth so the api client is exercised in both modes.
vi.mock("../config", () => ({
  getConfig: vi.fn(),
}));
vi.mock("../auth", () => ({
  getIdToken: vi.fn(),
}));

import { fetchState, saveState } from "../api";
import { getConfig } from "../config";
import { getIdToken } from "../auth";

const CLOUD = {
  apiUrl: "https://api.example.com",
  authEnabled: true,
  statePath: "/state",
};
const LOCAL = {
  apiUrl: "http://localhost:8787",
  authEnabled: false,
  statePath: "/api/state",
};

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("api client", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("attaches a Bearer token in cloud mode", async () => {
    vi.mocked(getConfig).mockReturnValue(CLOUD as never);
    vi.mocked(getIdToken).mockResolvedValue("tok-123");
    const fn = mockFetch(200, { state: { version: 1 } });

    await fetchState();

    const [url, init] = fn.mock.calls[0];
    expect(url).toBe("https://api.example.com/state");
    expect(init.headers.Authorization).toBe("Bearer tok-123");
  });

  it("sends no Authorization header in local dev mode", async () => {
    vi.mocked(getConfig).mockReturnValue(LOCAL as never);
    const fn = mockFetch(200, { state: { version: 1 } });

    await fetchState();

    const [url, init] = fn.mock.calls[0];
    expect(url).toBe("http://localhost:8787/api/state");
    expect(init.headers.Authorization).toBeUndefined();
    expect(getIdToken).not.toHaveBeenCalled();
  });

  it("returns null on 404", async () => {
    vi.mocked(getConfig).mockReturnValue(LOCAL as never);
    mockFetch(404, { error: "none" });
    expect(await fetchState()).toBeNull();
  });

  it("swallows network errors (best-effort) on save", async () => {
    vi.mocked(getConfig).mockReturnValue(LOCAL as never);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(saveState({ version: 1 } as never)).resolves.toBeUndefined();
  });
});
