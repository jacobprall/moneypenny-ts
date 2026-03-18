/**
 * Run user-defined operation scripts from DB.
 * Uses Bun's new Function() — trusted-first.
 */

import type { Database } from "bun:sqlite";
import type { OperationContext } from "../../core/context";
import { createHelpers } from "../../helpers";
import * as repo from "./repository";

export async function runUserOperation(
  ctx: OperationContext,
  name: string,
  input: unknown
): Promise<unknown> {
  const scriptRow = repo.getByName(ctx.db, name);
  if (!scriptRow) {
    throw new Error(`User operation not found or disabled: ${name}`);
  }

  const helpers = createHelpers({
    db: ctx.db,
    actor: ctx.actor,
    sessionId: ctx.sessionId,
    input,
  });

  const fn = new Function(
    "ctx",
    "helpers",
    "input",
    `
    const { db, actor, sessionId } = ctx;
    const { execute, searchKnowledge, addFact, searchFacts } = helpers;
    return (async function() {
      ${scriptRow.script}
    })();
  `
  );

  return fn(ctx, helpers, input);
}
