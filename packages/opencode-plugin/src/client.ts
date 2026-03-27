/**
 * HTTP client for Moneypenny brain (mp serve).
 */

import type { PolicyEvaluateResult, SearchHit } from "./contracts.js";

export type { PolicyEvaluateResult, SearchHit };

export class BrainClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: typeof fetch = fetch
  ) {}

  private url(path: string): string {
    const base = this.baseUrl.replace(/\/$/, "");
    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  }

  async health(): Promise<{ status: string } | null> {
    try {
      const res = await this.fetchFn(this.url("/health"), { method: "GET" });
      if (!res.ok) return null;
      return (await res.json()) as { status: string };
    } catch {
      return null;
    }
  }

  async getContext(
    query: string,
    opts?: { limit?: number; maxChars?: number }
  ): Promise<string | null> {
    if (!query.trim()) return null;
    try {
      const res = await this.fetchFn(this.url("/api/context"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          limit: opts?.limit ?? 5,
          maxChars: opts?.maxChars ?? 2000,
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { context?: string };
      const ctx = data.context?.trim();
      return ctx && ctx.length > 0 ? ctx : null;
    } catch {
      return null;
    }
  }

  async evaluatePolicy(input: {
    actor: string;
    action: string;
    resource: string;
    denyByDefault?: boolean;
    sessionId?: string;
  }): Promise<PolicyEvaluateResult | null> {
    try {
      const res = await this.fetchFn(this.url("/api/policy/evaluate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) return null;
      return (await res.json()) as PolicyEvaluateResult;
    } catch {
      return null;
    }
  }

  async appendEvent(event: {
    operation: string;
    actor: string;
    sessionId?: string | null;
    input?: unknown;
    output?: unknown;
    error?: string | null;
    durationMs?: number | null;
  }): Promise<{ id: string } | null> {
    try {
      const res = await this.fetchFn(this.url("/api/events"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
      if (!res.ok) return null;
      return (await res.json()) as { id: string };
    } catch {
      return null;
    }
  }

  async addFact(input: {
    content: string;
    keywords?: string[];
    confidence?: number;
    sessionId?: string;
  }): Promise<{ id: string } | null> {
    try {
      const res = await this.fetchFn(this.url("/api/facts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) return null;
      return (await res.json()) as { id: string };
    } catch {
      return null;
    }
  }

  async searchFacts(query: string, limit?: number): Promise<SearchHit[]> {
    try {
      const res = await this.fetchFn(this.url("/api/facts/search"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit }),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { results?: SearchHit[] };
      return data.results ?? [];
    } catch {
      return [];
    }
  }

  async searchKnowledge(query: string, limit?: number): Promise<SearchHit[]> {
    try {
      const res = await this.fetchFn(this.url("/api/knowledge/search"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit }),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { results?: SearchHit[] };
      return data.results ?? [];
    } catch {
      return [];
    }
  }

  async ingest(input: {
    source: "url" | "file" | "text";
    url?: string;
    path?: string;
    content?: string;
    context?: string;
    title?: string;
    sessionId?: string;
  }): Promise<{ id: string; title?: string } | null> {
    try {
      const res = await this.fetchFn(this.url("/api/knowledge/ingest"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) return null;
      return (await res.json()) as { id: string; title?: string };
    } catch {
      return null;
    }
  }
}
