import { register } from "../../core/operations";
import { add, list, disable, evaluate } from "./operations";

export * as repo from "./repository";
export { add, list, disable, evaluate } from "./operations";

export function registerPolicyOperations(): void {
  register(add);
  register(list);
  register(disable);
  register(evaluate);
}
