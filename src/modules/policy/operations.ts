import type { OperationContext } from "../../core/context";
import { evaluatePolicy } from "../../core/policy";
import * as repo from "./repository";

export interface AddInput {
  name: string;
  effect: "allow" | "deny" | "audit";
  priority?: number;
  actionPattern?: string | null;
  resourcePattern?: string | null;
  actorPattern?: string | null;
  message?: string | null;
}

export interface AddOutput {
  id: string;
}

export const add = {
  name: "policy.add",
  async execute(ctx: OperationContext, input: AddInput): Promise<AddOutput> {
    const now = Date.now();
    const id = crypto.randomUUID();
    repo.insert(ctx.db, {
      id,
      name: input.name,
      effect: input.effect,
      priority: input.priority ?? 0,
      actionPattern: input.actionPattern ?? null,
      resourcePattern: input.resourcePattern ?? null,
      actorPattern: input.actorPattern ?? null,
      message: input.message ?? null,
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
  policies: Array<{
    id: string;
    name: string;
    effect: string;
    priority: number;
    actionPattern: string | null;
    resourcePattern: string | null;
    actorPattern: string | null;
    message: string | null;
    enabled: number;
  }>;
}

export const list = {
  name: "policy.list",
  async execute(ctx: OperationContext, input: ListInput): Promise<ListOutput> {
    const policies = repo.list(ctx.db, { enabledOnly: input.enabledOnly });
    return {
      policies: policies.map((p) => ({
        id: p.id,
        name: p.name,
        effect: p.effect,
        priority: p.priority,
        actionPattern: p.actionPattern,
        resourcePattern: p.resourcePattern,
        actorPattern: p.actorPattern,
        message: p.message,
        enabled: p.enabled,
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
  name: "policy.disable",
  async execute(ctx: OperationContext, input: DisableInput): Promise<DisableOutput> {
    repo.setEnabled(ctx.db, input.id, 0);
    return { disabled: true };
  },
};

export interface EvaluateInput {
  actor: string;
  action: string;
  resource: string;
  denyByDefault?: boolean;
}

export interface EvaluateOutput {
  effect: "allow" | "deny" | "audit";
  matchedPolicy: { id: string; name: string } | null;
  reason: string;
}

export const evaluate = {
  name: "policy.evaluate",
  async execute(ctx: OperationContext, input: EvaluateInput): Promise<EvaluateOutput> {
    const decision = evaluatePolicy(
      ctx.db,
      input.actor,
      input.action,
      input.resource,
      input.denyByDefault ?? false
    );
    return {
      effect: decision.effect,
      matchedPolicy: decision.matchedPolicy
        ? { id: decision.matchedPolicy.id, name: decision.matchedPolicy.name }
        : null,
      reason: decision.reason,
    };
  },
};
