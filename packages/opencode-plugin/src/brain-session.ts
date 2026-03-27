import type { BrainClient } from "./client.js";

/** LRU-ish map: refresh on set, evict oldest when over capacity. */
export class PromptLru {
  private readonly m = new Map<string, string>();
  constructor(private readonly maxEntries: number) {}

  set(sessionId: string, text: string): void {
    if (this.m.has(sessionId)) this.m.delete(sessionId);
    this.m.set(sessionId, text);
    while (this.m.size > this.maxEntries) {
      const first = this.m.keys().next().value;
      if (first === undefined) break;
      this.m.delete(first);
    }
  }

  get(sessionId: string): string | undefined {
    return this.m.get(sessionId);
  }

  delete(sessionId: string): void {
    this.m.delete(sessionId);
  }
}

/** Tool call start times; prunes stale entries before new writes. */
export class CallTimerMap {
  constructor(private readonly maxAgeMs: number) {}

  private readonly t = new Map<string, number>();

  prune(): void {
    const now = Date.now();
    for (const [id, started] of this.t) {
      if (now - started > this.maxAgeMs) this.t.delete(id);
    }
  }

  start(callID: string): void {
    this.prune();
    this.t.set(callID, Date.now());
  }

  takeMs(callID: string): number | undefined {
    const started = this.t.get(callID);
    this.t.delete(callID);
    if (started === undefined) return undefined;
    return Date.now() - started;
  }

  delete(callID: string): void {
    this.t.delete(callID);
  }
}

export class CachedBrainHealth {
  private cache: { ok: boolean; at: number } | null = null;

  constructor(
    private readonly getClient: () => BrainClient,
    private readonly getTtlMs: () => number
  ) {}

  reset(): void {
    this.cache = null;
  }

  async ok(): Promise<boolean> {
    const ttlMs = this.getTtlMs();
    const now = Date.now();
    if (this.cache !== null && now - this.cache.at < ttlMs) {
      return this.cache.ok;
    }
    const h = await this.getClient().health();
    const ok = !!h;
    this.cache = { ok, at: now };
    return ok;
  }
}
