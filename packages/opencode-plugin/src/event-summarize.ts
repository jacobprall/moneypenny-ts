import type { Event } from "@opencode-ai/sdk";

/** Small payload for brain activity instead of the full OpenCode event object. */
export function summarizeOpencodeEvent(event: Event): Record<string, unknown> {
  const e = event as { type?: string; properties?: { info?: { id?: string; title?: string } } };
  const out: Record<string, unknown> = { type: e.type ?? "unknown" };
  const t = e.type;
  if (t === "session.created" || t === "session.updated" || t === "session.deleted") {
    const info = e.properties?.info;
    if (info?.id) out.sessionId = info.id;
    if (info?.title) out.sessionTitle = info.title;
  }
  return out;
}

export function sessionIdFromLifecycleEvent(event: Event): string | undefined {
  const e = event as { type?: string; properties?: { info?: { id?: string } } };
  const t = e.type;
  if (t === "session.deleted" && e.properties?.info?.id) return e.properties.info.id;
  return undefined;
}
