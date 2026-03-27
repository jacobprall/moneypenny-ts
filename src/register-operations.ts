/**
 * Register all domain operations once per process.
 * Used by CLI, MCP, HTTP (via imported execute), and tests.
 */

import { registerActivityOperations } from "./modules/activity";
import { registerEmbedderOperations } from "./modules/embedder";
import { registerFactsOperations } from "./modules/facts";
import { registerHooksOperations } from "./modules/hooks";
import { registerJobsOperations } from "./modules/jobs";
import { registerKnowledgeOperations } from "./modules/knowledge";
import { registerOperations } from "./modules/operations";
import { registerPolicyOperations } from "./modules/policy";
import { registerSessionOperations } from "./modules/session";

export function registerAllOperations(): void {
  registerKnowledgeOperations();
  registerFactsOperations();
  registerEmbedderOperations();
  registerSessionOperations();
  registerJobsOperations();
  registerPolicyOperations();
  registerHooksOperations();
  registerOperations();
  registerActivityOperations();
}
