import { register } from "../../core/operations";
import { create, run, get } from "./operations";

export function registerSessionOperations(): void {
  register(create);
  register(run);
  register(get);
}

export { create, run, get } from "./operations";
