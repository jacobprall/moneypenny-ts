/**
 * Config loading — brain.toml, env, defaults.
 */

import { join } from "path";
import { existsSync } from "fs";

export interface ModelConfig {
  default?: string;
}

export interface ProviderConfig {
  api_key_env?: string;
  api_key?: string;
}

export interface BrainConfig {
  denyByDefault: boolean;
  dataDir: string;
  configPath?: string;
  model?: ModelConfig;
  provider?: Record<string, ProviderConfig>;
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
  let model: ModelConfig = {};
  let provider: Record<string, ProviderConfig> = {};

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
      if (parsed.model && typeof parsed.model === "object") {
        if (typeof parsed.model.default === "string") model.default = parsed.model.default;
      }
      if (parsed.provider && typeof parsed.provider === "object") {
        for (const [k, v] of Object.entries(parsed.provider)) {
          if (v && typeof v === "object") {
            provider[k] = {
              api_key_env: typeof (v as any).api_key_env === "string" ? (v as any).api_key_env : undefined,
              api_key: typeof (v as any).api_key === "string" ? (v as any).api_key : undefined,
            };
          }
        }
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
    model,
    provider,
  };
}
