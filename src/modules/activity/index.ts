import { register } from "../../core/operations";
import { query, append } from "./operations";

export { query, append } from "./operations";

export function registerActivityOperations(): void {
  register(query);
  register(append);
}
