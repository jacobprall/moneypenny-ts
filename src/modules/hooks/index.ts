import { register } from "../../core/operations";
import { add, list, disable } from "./operations";

export * as repo from "./repository";
export { add, list, disable } from "./operations";

export function registerHooksOperations(): void {
  register(add);
  register(list);
  register(disable);
}
