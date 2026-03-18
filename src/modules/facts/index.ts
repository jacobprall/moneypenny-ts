import { register } from "../../core/operations";
import { add, search } from "./operations";

export { add, search } from "./operations";

export function registerFactsOperations(): void {
  register(add);
  register(search);
}
