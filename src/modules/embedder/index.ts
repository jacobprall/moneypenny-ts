import { register } from "../../core/operations";
import { run } from "./operations";

export function registerEmbedderOperations(): void {
  register(run);
}

export { run } from "./operations";
