import { readFileSync } from "fs";
import { join } from "path";

/** Package version from moneypenny-brain package.json (src/ → project root). */
export const BRAIN_PKG_VERSION: string = (() => {
  try {
    const path = join(import.meta.dir, "..", "package.json");
    const raw = readFileSync(path, "utf8");
    return (JSON.parse(raw) as { version: string }).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();
