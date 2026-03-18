import { register } from "../../core/operations";
import { add, list, run, disable, remove } from "./operations";

export * as repo from "./repository";
export { add, list, run, disable, remove } from "./operations";
export { runUserOperation } from "./runner";

export function registerOperations(): void {
  register(add);
  register(list);
  register(run);
  register(disable);
  register(remove);
}
