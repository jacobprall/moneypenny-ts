/**
 * Ensures domain operations are registered exactly once per test process.
 * Import `ensureOperationsRegistered` from each test file (or rely on harness).
 */

import { registerAllOperations } from "../src/register-operations";

let registered = false;

export function ensureOperationsRegistered(): void {
  if (registered) return;
  registerAllOperations();
  registered = true;
}
