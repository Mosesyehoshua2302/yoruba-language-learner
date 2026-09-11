/**
 * Runtime content loader.
 *
 * The learning content (`content.json`) and sentence bank (`sentences.json`)
 * are fetched at startup rather than bundled into the JS. In the cloud they are
 * served from the S3/CloudFront bucket alongside `config.json`; in local dev
 * Vite serves the copies in `public/`. Keeping them out of the bundle means
 * content can be updated (re-uploaded) without rebuilding the app.
 *
 * Both are fetched once, before the app renders (see main.tsx), so the store
 * can initialize synchronously from `getContent()` and every consumer can keep
 * reading content as a plain value.
 */
import type { Content, SentencesData } from "../types";

let content: Content | null = null;
let sentences: SentencesData | null = null;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${url} ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Load content + sentences once. Must be awaited before the store mounts.
 * Throws if the files can't be fetched — the app cannot run without content,
 * so failing loudly here is correct (main.tsx surfaces it).
 */
export async function loadContent(): Promise<void> {
  if (content && sentences) return;
  const [c, s] = await Promise.all([
    fetchJson<Content>("/content.json"),
    fetchJson<SentencesData>("/sentences.json"),
  ]);
  content = c;
  sentences = s;
}

/** Synchronous accessor; throws if called before loadContent() resolves. */
export function getContent(): Content {
  if (!content)
    throw new Error("content not loaded — call loadContent() first");
  return content;
}

/** Synchronous accessor; throws if called before loadContent() resolves. */
export function getSentences(): SentencesData {
  if (!sentences)
    throw new Error("sentences not loaded — call loadContent() first");
  return sentences;
}

/** Test-only: reset the module cache. */
export function __resetContentForTests(): void {
  content = null;
  sentences = null;
}
