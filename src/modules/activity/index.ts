import { register } from "../../core/operations";
import { query } from "./operations";

export { query } from "./operations";

export function registerActivityOperations(): void {
  register(query);
}
