import { beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal in-memory localStorage before importing the module under test.
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  get size() {
    return this.m.size;
  }
  keys() {
    return [...this.m.keys()];
  }
}

const mem = new MemStorage();
vi.stubGlobal('localStorage', mem as unknown as Storage);

import * as storage from '../storage';
import type { Content } from '../../types';

// A tiny content fixture: one chapter, one vocab item.
const content = {
  chapters: [
    { id: 1, items: [{ id: 'c1-v1', type: 'vocab', pos: 'noun', yo: 'a', en: 'b' }] },
  ],
} as unknown as Content;

describe('sub-namespaced storage', () => {
  beforeEach(() => {
    for (const k of mem.keys()) mem.removeItem(k);
  });

  it('writes under a key namespaced by sub', () => {
    const s = storage.freshState(content);
    storage.save(s, 'user-A');
    expect(mem.keys().some((k) => k.endsWith(':user-A'))).toBe(true);
    expect(mem.keys().some((k) => k.endsWith(':user-B'))).toBe(false);
  });

  it('does not leak one user\'s state to another', () => {
    const s = storage.freshState(content);
    s.newPerDay = 42; // a marker value
    storage.save(s, 'user-A');

    // user-B has nothing saved -> gets a fresh state, not user-A's.
    const loadedB = storage.load(content, 'user-B');
    expect(loadedB.newPerDay).not.toBe(42);

    // user-A still reads their own marked state.
    const loadedA = storage.load(content, 'user-A');
    expect(loadedA.newPerDay).toBe(42);
  });

  it('reset only clears the given user', () => {
    storage.save(storage.freshState(content), 'user-A');
    storage.save(storage.freshState(content), 'user-B');
    storage.reset('user-A');
    expect(mem.keys().some((k) => k.endsWith(':user-A'))).toBe(false);
    expect(mem.keys().some((k) => k.endsWith(':user-B'))).toBe(true);
  });
});
