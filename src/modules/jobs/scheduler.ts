/**
 * Scheduler: finds due jobs, dispatches as operations, records runs.
 */

import cronParser from "cron-parser";
import type { Database } from "bun:sqlite";
import { execute } from "../../core/operations";
import * as repo from "./repository";

const ACTOR = "scheduler";

export function startScheduler(db: Database, intervalMs = 60_000): () => void {
  const tick = async () => {
    const now = Date.now();
    const due = repo.findDue(db, now);
    for (const job of due) {
      const runId = crypto.randomUUID();
      try {
        const startedAt = Date.now();
        repo.insertRun(db, {
          id: runId,
          jobId: job.id,
          startedAt,
          endedAt: null,
          status: "running",
          result: null,
          error: null,
          retryCount: 0,
          createdAt: startedAt,
        });

        const payload = job.payload ? (JSON.parse(job.payload) as Record<string, unknown>) : {};
        const result = await Promise.race([
          execute(job.operation, payload, { db, actor: ACTOR }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), job.timeoutMs)
          ),
        ]);

        const endedAt = Date.now();
        repo.updateRun(db, runId, {
          endedAt,
          status: "completed",
          result: JSON.stringify(result),
        });
        repo.updateLastRun(db, job.id, endedAt);
        repo.updateNextRun(db, job.id, cronParser.parse(job.schedule).next().toDate().getTime());
      } catch (err) {
        const endedAt = Date.now();
        const errorMsg = err instanceof Error ? err.message : String(err);
        repo.updateRun(db, runId, {
          endedAt,
          status: "failed",
          error: errorMsg,
        });
        repo.updateLastRun(db, job.id, endedAt);
        repo.updateNextRun(db, job.id, cronParser.parse(job.schedule).next().toDate().getTime());
      }
    }
  };

  const id = setInterval(tick, intervalMs);
  tick(); // run immediately

  return () => clearInterval(id);
}
