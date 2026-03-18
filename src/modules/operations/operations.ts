import type { OperationContext } from "../../core/context";
import { runUserOperation } from "./runner";
import * as repo from "./repository";

export interface AddInput {
  name: string;
  description?: string | null;
  inputSchema?: string | null;
  script: string;
}

export interface AddOutput {
  id: string;
}

export const add = {
  name: "operations.add",
  async execute(ctx: OperationContext, input: AddInput): Promise<AddOutput> {
    const now = Date.now();
    const id = crypto.randomUUID();
    repo.insert(ctx.db, {
      id,
      name: input.name,
      description: input.description ?? null,
      inputSchema: input.inputSchema ?? null,
      script: input.script,
      enabled: 1,
      createdAt: now,
      updatedAt: now,
    });
    return { id };
  },
};

export interface ListInput {
  enabledOnly?: boolean;
}

export interface ListOutput {
  operations: Array<{
    id: string;
    name: string;
    description: string | null;
    enabled: number;
  }>;
}

export const list = {
  name: "operations.list",
  async execute(ctx: OperationContext, input: ListInput): Promise<ListOutput> {
    const ops = repo.list(ctx.db, { enabledOnly: input.enabledOnly });
    return {
      operations: ops.map((o) => ({
        id: o.id,
        name: o.name,
        description: o.description,
        enabled: o.enabled,
      })),
    };
  },
};

export interface RunInput {
  name: string;
  input?: unknown;
}

export const run = {
  name: "operations.run",
  async execute(ctx: OperationContext, input: RunInput): Promise<unknown> {
    return runUserOperation(ctx, input.name, input.input ?? {});
  },
};

export interface DisableInput {
  id: string;
}

export interface DisableOutput {
  disabled: boolean;
}

export const disable = {
  name: "operations.disable",
  async execute(ctx: OperationContext, input: DisableInput): Promise<DisableOutput> {
    repo.setEnabled(ctx.db, input.id, 0);
    return { disabled: true };
  },
};

export interface RemoveInput {
  id: string;
}

export interface RemoveOutput {
  removed: boolean;
}

export const remove = {
  name: "operations.remove",
  async execute(ctx: OperationContext, input: RemoveInput): Promise<RemoveOutput> {
    repo.remove(ctx.db, input.id);
    return { removed: true };
  },
};
