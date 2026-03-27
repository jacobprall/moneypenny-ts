/**
 * LLM streaming via Vercel AI SDK.
 */

import { streamText } from "ai";
import type { CoreMessage, CoreTool } from "ai";
import type { BrainConfig } from "../core/config";
import { resolveModel, getLanguageModel } from "./provider";

export interface StreamInput {
  model: BrainConfig;
  system: string;
  messages: CoreMessage[];
  tools?: Record<string, CoreTool>;
  abort?: AbortSignal;
}

export type StreamResult = Awaited<ReturnType<typeof streamText>>;

export async function stream(input: StreamInput): Promise<StreamResult> {
  const { provider, modelId } = resolveModel(input.model);
  const model = getLanguageModel(input.model, provider, modelId);

  return streamText({
    model,
    system: input.system,
    messages: input.messages,
    tools: input.tools,
    toolChoice: input.tools ? "auto" : undefined,
    maxSteps: input.tools ? 10 : 1,
    abortSignal: input.abort,
    maxRetries: 2,
  });
}
