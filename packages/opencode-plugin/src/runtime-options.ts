import type { MoneypennyFileConfig } from "./contracts.js";

const DEFAULT_URL = "http://localhost:3123";
const DEFAULT_SKIP = ["embed", "3.5-haiku", "haiku-3"];

export type RuntimeOptions = {
  baseUrl: string;
  contextEnabled: boolean;
  policyEnabled: boolean;
  auditEnabled: boolean;
  contextMaxChars: number;
  contextLimit: number;
  skipModelSubstrings: string[];
  healthTtlMs: number;
  promptLruMax: number;
  callTimerMaxAgeMs: number;
};

export function createRuntimeOptions(): RuntimeOptions {
  const envSkip = (process.env.MONEYPENNY_SKIP_MODELS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    baseUrl: process.env.MONEYPENNY_URL ?? DEFAULT_URL,
    contextEnabled: process.env.MONEYPENNY_CONTEXT_ENABLED !== "0",
    policyEnabled: process.env.MONEYPENNY_POLICY_ENABLED !== "0",
    auditEnabled: process.env.MONEYPENNY_AUDIT_ENABLED !== "0",
    contextMaxChars: parseInt(process.env.MONEYPENNY_CONTEXT_MAX_CHARS ?? "2000", 10) || 2000,
    contextLimit: parseInt(process.env.MONEYPENNY_CONTEXT_LIMIT ?? "5", 10) || 5,
    skipModelSubstrings: [...DEFAULT_SKIP, ...envSkip],
    healthTtlMs: parseInt(process.env.MONEYPENNY_HEALTH_TTL_MS ?? "3000", 10) || 3000,
    promptLruMax: parseInt(process.env.MONEYPENNY_PROMPT_LRU_MAX ?? "256", 10) || 256,
    callTimerMaxAgeMs: parseInt(process.env.MONEYPENNY_CALL_TIMER_MAX_MS ?? "600000", 10) || 600_000,
  };
}

export function applyMoneypennyFileConfig(opts: RuntimeOptions, raw: unknown): void {
  if (!raw || typeof raw !== "object") return;
  const m = raw as MoneypennyFileConfig;
  if (typeof m.url === "string" && m.url.trim()) opts.baseUrl = m.url.trim();
  if (m.context?.enabled === false) opts.contextEnabled = false;
  if (m.context?.enabled === true) opts.contextEnabled = true;
  if (typeof m.context?.maxChars === "number") opts.contextMaxChars = m.context.maxChars;
  if (typeof m.context?.limit === "number") opts.contextLimit = m.context.limit;
  if (m.policy?.enabled === false) opts.policyEnabled = false;
  if (m.policy?.enabled === true) opts.policyEnabled = true;
  if (m.audit?.enabled === false) opts.auditEnabled = false;
  if (m.audit?.enabled === true) opts.auditEnabled = true;
  if (Array.isArray(m.skipModelSubstrings)) {
    const extra = m.skipModelSubstrings.filter((s): s is string => typeof s === "string");
    opts.skipModelSubstrings = [...new Set([...opts.skipModelSubstrings, ...extra])];
  }
}
