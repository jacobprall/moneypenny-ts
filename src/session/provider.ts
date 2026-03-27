/**
 * Model resolution — resolve model string to AI SDK language model.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModelV1 } from "ai";
import type { BrainConfig } from "../core/config";

const DEFAULT_MODEL = "anthropic/claude-sonnet-4-20250514";

export function resolveModel(config: BrainConfig): { provider: string; modelId: string } {
  const modelStr = config.model?.default ?? process.env.BRAIN_MODEL ?? DEFAULT_MODEL;
  const [provider, modelId] = modelStr.includes("/") ? modelStr.split("/", 2) : ["anthropic", modelStr];
  return { provider, modelId };
}

export function getLanguageModel(
  config: BrainConfig,
  provider: string,
  modelId: string
): LanguageModelV1 {
  const apiKey =
    config.provider?.[provider]?.api_key ??
    (config.provider?.[provider]?.api_key_env
      ? process.env[config.provider[provider].api_key_env!]
      : undefined) ??
    (provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : undefined);

  if (provider === "anthropic") {
    const anthropic = createAnthropic(apiKey ? { apiKey } : undefined);
    return anthropic(modelId as "claude-sonnet-4-20250514");
  }

  throw new Error(`Unknown provider: ${provider}. Supported: anthropic`);
}
