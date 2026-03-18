import { register } from "../../core/operations";
import { create, list, pause, resume } from "./operations";

export { create, list, pause, resume } from "./operations";
export { startScheduler } from "./scheduler";
export * from "./repository";

export function registerJobsOperations(): void {
  register(create);
  register(list);
  register(pause);
  register(resume);
}
