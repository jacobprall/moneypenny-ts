import { register } from "../../core/operations";
import { add, search, list, deleteOp, ingest } from "./operations";

export { add, search, list, deleteOp, ingest } from "./operations";
export * from "./repository";

export function registerKnowledgeOperations(): void {
  register(add);
  register(search);
  register(list);
  register(deleteOp);
  register(ingest);
}
