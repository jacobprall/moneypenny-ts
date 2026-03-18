/**
 * Config loading — brain.toml, env, defaults.
 */

import { join } from "path";
import { existsSync } from "fs";

export interface BrainConfig {
  denyByDefault: boolean;
  dataDir: string;
  configPath?: string;
}

/**
 * Load config. Order: env vars > brain.toml > defaults.
 */
export async function loadConfig(options?: {
  configPath?: string;
  dataDir?: string;
}): Promise<BrainConfig> {
  const configPath =
    options?.configPath ??
    process.env.BRAIN_CONFIG ??
    join(process.cwd(), "brain.toml");

  let denyByDefault = false;
  let dataDir = options?.dataDir ?? process.env.BRAIN_DATA ?? join(process.cwd(), "data");

  if (existsSync(configPath)) {
    try {
      const tomlMod = await import("toml");
      const toml = tomlMod.default ?? tomlMod;
      const content = await Bun.file(configPath).text();
      const parsed = toml.parse(content);
      if (typeof parsed.deny_by_default === "boolean") {
        denyByDefault = parsed.deny_by_default;
      }
      if (typeof parsed.data_dir === "string") {
        dataDir = parsed.data_dir;
      }
    } catch {
      // use defaults
    }
  }

  const envDeny = process.env.BRAIN_DENY_BY_DEFAULT;
  if (envDeny === "1" || envDeny === "true" || envDeny === "yes") {
    denyByDefault = true;
  }

  return {
    denyByDefault,
    dataDir,
    configPath: existsSync(configPath) ? configPath : undefined,
  };
}
