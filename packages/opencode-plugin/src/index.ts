/**
 * Moneypenny OpenCode plugin — brain context, audit, policy, tools.
 * Requires `mp serve` (Moneypenny brain HTTP on localhost:3123 by default).
 */

import type { Plugin } from "@opencode-ai/plugin";
import type { Config } from "@opencode-ai/sdk";
import { BrainClient } from "./client.js";
import { CachedBrainHealth, CallTimerMap, PromptLru } from "./brain-session.js";
import { createBrainTools } from "./brain-tools.js";
import { createMoneypennyHooks } from "./hooks.js";
import { applyMoneypennyFileConfig, createRuntimeOptions } from "./runtime-options.js";

let brainDownWarned = false;

function warnBrainOnce(message: string) {
  if (brainDownWarned) return;
  console.warn(`[moneypenny] ${message}`);
  brainDownWarned = true;
}

export const MoneypennyPlugin: Plugin = async (_input) => {
  const opts = createRuntimeOptions();
  const session = {
    brain: new BrainClient(opts.baseUrl),
    prompts: new PromptLru(opts.promptLruMax),
    timers: new CallTimerMap(opts.callTimerMaxAgeMs),
  };
  const health = new CachedBrainHealth(() => session.brain, () => opts.healthTtlMs);

  function onBrainReachable() {
    brainDownWarned = false;
  }

  async function brainOkForTools(): Promise<boolean> {
    const ok = await health.ok();
    if (!ok) {
      warnBrainOnce(
        `Brain not reachable at ${opts.baseUrl}. Start with: mp serve (from moneypenny-brain)`
      );
      return false;
    }
    onBrainReachable();
    return true;
  }

  return {
    config: async (cfg: Config) => {
      const raw = (cfg as unknown as Record<string, unknown>)["moneypenny"];
      applyMoneypennyFileConfig(opts, raw);
      session.brain = new BrainClient(opts.baseUrl);
      session.prompts = new PromptLru(opts.promptLruMax);
      session.timers = new CallTimerMap(opts.callTimerMaxAgeMs);
      health.reset();
    },

    ...createMoneypennyHooks({
      opts,
      session,
      health,
      onBrainReachable,
      warnBrainOnce,
    }),

    tool: createBrainTools({
      brainOk: brainOkForTools,
      getBrain: () => session.brain,
    }),
  };
};

export default MoneypennyPlugin;
