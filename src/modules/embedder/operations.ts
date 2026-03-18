import type { OperationContext } from "../../core/context";
import { runEmbedderBatch } from "../../pipeline/embedder-job";

export interface RunInput {
  /** Optional; no-op for now. Reserved for batch size override. */
  batchSize?: number;
}

export interface RunOutput {
  embedded: number;
}

export const run = {
  name: "embedder.run",
  async execute(ctx: OperationContext, _input: RunInput = {}): Promise<RunOutput> {
    const embedded = await runEmbedderBatch(ctx.db);
    return { embedded };
  },
};
