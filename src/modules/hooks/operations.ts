import type { OperationContext } from "../../core/context";
import * as repo from "./repository";

export interface AddInput {
  name: string;
  phase: string;
  matchPattern: string;
  priority?: number;
  script: string;
}

export interface AddOutput {
  id: string;
}

export const add = {
  name: "hooks.add",
  async execute(ctx: OperationContext, input: AddInput): Promise<AddOutput> {
    const now = Date.now();
    const id = crypto.randomUUID();
    repo.insert(ctx.db, {
      id,
      name: input.name,
      phase: input.phase,
      matchPattern: input.matchPattern,
      priority: input.priority ?? 0,
      script: input.script,
      enabled: 1,
      createdAt: now,
      updatedAt: now,
    });
    return { id };
  },
};

export interface ListInput {
  phase?: string;
}

export interface ListOutput {
  hooks: Array<{
    id: string;
    name: string;
    phase: string;
    matchPattern: string;
    priority: number;
    enabled: number;
  }>;
}

export const list = {
  name: "hooks.list",
  async execute(ctx: OperationContext, input: ListInput): Promise<ListOutput> {
    const hooks = repo.list(ctx.db, { phase: input.phase });
    return {
      hooks: hooks.map((h) => ({
        id: h.id,
        name: h.name,
        phase: h.phase,
        matchPattern: h.matchPattern,
        priority: h.priority,
        enabled: h.enabled,
      })),
    };
  },
};

export interface DisableInput {
  id: string;
}

export interface DisableOutput {
  disabled: boolean;
}

export const disable = {
  name: "hooks.disable",
  async execute(ctx: OperationContext, input: DisableInput): Promise<DisableOutput> {
    repo.setEnabled(ctx.db, input.id, 0);
    return { disabled: true };
  },
};
