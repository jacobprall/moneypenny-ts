import type { Hooks } from "@opencode-ai/plugin";
import type { BrainClient } from "./client.js";
import { CachedBrainHealth, CallTimerMap, PromptLru } from "./brain-session.js";
import { summarizeOpencodeEvent, sessionIdFromLifecycleEvent } from "./event-summarize.js";
import { permissionResourceFromOpenCode } from "./permission-resource.js";
import type { RuntimeOptions } from "./runtime-options.js";
import { extractTextFromParts, shouldSkipBrainContext } from "./util.js";

/** Mutable session bag so `config` can swap brain / LRU / timers without stale hook closures. */
export type PluginSession = {
  brain: BrainClient;
  prompts: PromptLru;
  timers: CallTimerMap;
};

export type HookBundleInput = {
  opts: RuntimeOptions;
  session: PluginSession;
  health: CachedBrainHealth;
  onBrainReachable: () => void;
  warnBrainOnce: (message: string) => void;
};

export function createMoneypennyHooks(input: HookBundleInput): Hooks {
  const { opts, session, health, onBrainReachable, warnBrainOnce } = input;

  async function brainOk(): Promise<boolean> {
    const ok = await health.ok();
    if (!ok) {
      warnBrainOnce(`Brain not reachable at ${opts.baseUrl}. Start with: mp serve (from moneypenny-brain)`);
      return false;
    }
    onBrainReachable();
    return true;
  }

  return {
    "chat.message": async (hookIn, output) => {
      const text = extractTextFromParts(output.parts as { type?: string; text?: string }[]);
      if (text && hookIn.sessionID) {
        session.prompts.set(hookIn.sessionID, text);
      }
    },

    "experimental.chat.system.transform": async (hookIn, out) => {
      if (!opts.contextEnabled) return;
      if (!hookIn.sessionID) return;
      const modelId = hookIn.model?.id ?? "";
      if (shouldSkipBrainContext(modelId, opts.skipModelSubstrings)) return;

      const query = session.prompts.get(hookIn.sessionID) ?? "";
      if (!query.trim()) return;
      if (!(await brainOk())) return;

      const ctx = await session.brain.getContext(query, {
        limit: opts.contextLimit,
        maxChars: opts.contextMaxChars,
      });
      if (ctx) {
        out.system.push(ctx);
      }
    },

    "experimental.session.compacting": async (hookIn, out) => {
      if (!opts.contextEnabled) return;
      if (!(await brainOk())) return;

      out.context.push(
        "IMPORTANT: Preserve architectural decisions, naming conventions, and facts " +
          "discussed in this session in your compaction summary."
      );

      const q = session.prompts.get(hookIn.sessionID) ?? "";
      if (!q.trim()) return;
      const brainCtx = await session.brain.getContext(q, {
        limit: opts.contextLimit,
        maxChars: Math.min(opts.contextMaxChars, 1200),
      });
      if (brainCtx) {
        out.context.push("Relevant brain context for this session:\n" + brainCtx);
      }
    },

    "tool.execute.before": async (hookIn) => {
      session.timers.start(hookIn.callID);
    },

    "tool.execute.after": async (hookIn, output) => {
      if (!opts.auditEnabled) return;
      const durationMs = session.timers.takeMs(hookIn.callID);

      if (!(await brainOk())) return;

      await session.brain.appendEvent({
        operation: `tool.${hookIn.tool}`,
        actor: `opencode:${hookIn.sessionID}`,
        sessionId: hookIn.sessionID,
        input: hookIn.args,
        output: { title: output.title, output: output.output, metadata: output.metadata },
        durationMs: durationMs ?? null,
      });
    },

    "permission.ask": async (perm, out) => {
      if (!opts.policyEnabled) return;
      if (!(await brainOk())) return;

      const resource = permissionResourceFromOpenCode(perm);

      const decision = await session.brain.evaluatePolicy({
        actor: `opencode:${perm.sessionID}`,
        action: perm.type,
        resource,
        sessionId: perm.sessionID,
      });
      if (!decision) return;

      if (decision.effect === "deny") {
        out.status = "deny";
      } else if (decision.effect === "allow" || decision.effect === "audit") {
        out.status = "allow";
      }
    },

    event: async ({ event }) => {
      const t = event.type;
      if (t === "session.deleted") {
        const sid = sessionIdFromLifecycleEvent(event);
        if (sid) session.prompts.delete(sid);
      }

      if (!opts.auditEnabled) return;
      if (t !== "session.created" && t !== "session.deleted") return;
      if (!(await brainOk())) return;

      const summary = summarizeOpencodeEvent(event);
      const sessionId =
        typeof summary.sessionId === "string" ? summary.sessionId : null;

      await session.brain.appendEvent({
        operation: `opencode.${t}`,
        actor: "opencode",
        sessionId,
        input: summary,
      });
    },
  };
}
