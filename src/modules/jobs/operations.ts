import cronParser from "cron-parser";
import type { OperationContext } from "../../core/context";
import { execute } from "../../core/operations";
import * as repo from "./repository";

function nextRunFromCron(schedule: string): number {
  const interval = cronParser.parse(schedule);
  return interval.next().toDate().getTime();
}

export interface CreateInput {
  name: string;
  description?: string;
  schedule: string;
  operation: string;
  payload?: Record<string, unknown>;
}

export interface CreateOutput {
  id: string;
  nextRunAt: number;
}

export const create = {
  name: "jobs.create",
  async execute(ctx: OperationContext, input: CreateInput): Promise<CreateOutput> {
    const now = Date.now();
    const id = crypto.randomUUID();
    const nextRunAt = nextRunFromCron(input.schedule);

    repo.insert(ctx.db, {
      id,
      name: input.name,
      description: input.description ?? null,
      schedule: input.schedule,
      operation: input.operation,
      payload: input.payload ? JSON.stringify(input.payload) : null,
      nextRunAt,
      overlapPolicy: "skip",
      maxRetries: 3,
      timeoutMs: 30000,
      status: "active",
      enabled: 1,
      createdAt: now,
      updatedAt: now,
    });

    return { id, nextRunAt };
  },
};

export interface ListInput {
  limit?: number;
}

export interface ListOutput {
  jobs: Array<{
    id: string;
    name: string;
    schedule: string;
    operation: string;
    nextRunAt: number | null;
    lastRunAt: number | null;
    status: string;
    enabled: number;
  }>;
}

export const list = {
  name: "jobs.list",
  async execute(ctx: OperationContext, input: ListInput): Promise<ListOutput> {
    const jobs = repo.list(ctx.db, input.limit ?? 100);
    return {
      jobs: jobs.map((j) => ({
        id: j.id,
        name: j.name,
        schedule: j.schedule,
        operation: j.operation,
        nextRunAt: j.nextRunAt,
        lastRunAt: j.lastRunAt,
        status: j.status,
        enabled: j.enabled,
      })),
    };
  },
};

export interface PauseInput {
  id: string;
}

export interface PauseOutput {
  paused: boolean;
}

export const pause = {
  name: "jobs.pause",
  async execute(ctx: OperationContext, input: PauseInput): Promise<PauseOutput> {
    repo.setEnabled(ctx.db, input.id, 0);
    return { paused: true };
  },
};

export interface ResumeInput {
  id: string;
}

export interface ResumeOutput {
  resumed: boolean;
}

export const resume = {
  name: "jobs.resume",
  async execute(ctx: OperationContext, input: ResumeInput): Promise<ResumeOutput> {
    const job = repo.getById(ctx.db, input.id);
    if (!job) throw new Error(`Job not found: ${input.id}`);
    const nextRunAt = nextRunFromCron(job.schedule);
    repo.setEnabled(ctx.db, input.id, 1);
    repo.updateNextRun(ctx.db, input.id, nextRunAt);
    return { resumed: true };
  },
};
