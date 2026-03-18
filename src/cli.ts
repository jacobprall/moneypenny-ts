#!/usr/bin/env bun
/**
 * brainstorm CLI — init, setup, serve, status, sync, policy, add-fact, search
 */

import { join, resolve } from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import type { Database } from "bun:sqlite";
import { connect } from "./db";
import { loadConfig } from "./core/config";
import type { BrainConfig } from "./core/config";
import { getSyncStatus, runCloudSync, setSyncConfig, getSyncConfig } from "./db";
import { execute } from "./core/operations";
import { registerKnowledgeOperations } from "./modules/knowledge";
import { registerFactsOperations } from "./modules/facts";
import { registerJobsOperations } from "./modules/jobs";
import { registerEmbedderOperations } from "./modules/embedder";
import { registerPolicyOperations } from "./modules/policy";
import { registerHooksOperations } from "./modules/hooks";
import { registerOperations } from "./modules/operations";
import { registerActivityOperations } from "./modules/activity";

// Register all operations for CLI use
registerKnowledgeOperations();
registerFactsOperations();
registerEmbedderOperations();
registerJobsOperations();
registerPolicyOperations();
registerHooksOperations();
registerOperations();
registerActivityOperations();

async function getCliContext(): Promise<{ config: BrainConfig; db: Database }> {
  const config = await loadConfig();
  const db = await connect({ path: resolve(config.dataDir, "brain.db") });
  return { config, db };
}

const DEFAULT_BRAIN_TOML = `# Brains config
# deny_by_default = false  # Set true for production
# data_dir = "./data"
`;

async function cmdInit(args: string[]) {
  const configPath = args[0] ?? join(process.cwd(), "brain.toml");
  const dir = join(configPath, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  if (existsSync(configPath)) {
    console.log(`Config already exists: ${configPath}`);
    return;
  }
  writeFileSync(configPath, DEFAULT_BRAIN_TOML);
  const dataDir = join(dir, "data");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  console.log(`Created ${configPath}`);
  console.log(`Data dir: ${dataDir}`);
}

async function cmdSetup() {
  const proc = Bun.spawn(["bun", "run", "scripts/setup-vendor.ts"], {
    cwd: join(import.meta.dir, ".."),
    stdout: "inherit",
    stderr: "inherit",
  });
  const exit = await proc.exited;
  if (exit !== 0) process.exit(exit);
  console.log("Run: bun install (for @sqliteai/sqlite-sync)");
}

async function cmdServe() {
  const proc = Bun.spawn(["bun", "run", "src/index.ts"], {
    cwd: join(import.meta.dir, ".."),
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });
  const exit = await proc.exited;
  process.exit(exit);
}

async function cmdStatus() {
  const { config, db } = await getCliContext();
  const syncStatus = getSyncStatus(db);

  const jobCount = (db.query("SELECT COUNT(*) as c FROM jobs WHERE enabled = 1").get() as { c: number })?.c ?? 0;
  const policyCount = (db.query("SELECT COUNT(*) as c FROM policies WHERE enabled = 1").get() as { c: number })?.c ?? 0;
  const documentCount = (db.query("SELECT COUNT(*) as c FROM documents WHERE status = 'active'").get() as { c: number })?.c ?? 0;

  console.log("Brains status");
  console.log("-------------");
  console.log(`Config: ${config.configPath ?? "default"}`);
  console.log(`Data:   ${config.dataDir}`);
  console.log(`Sync:   ${syncStatus.available ? "enabled" : "disabled"}`);
  if (syncStatus.available) {
    console.log(`  Site ID:   ${syncStatus.siteId ?? "—"}`);
    console.log(`  DB ver:    ${syncStatus.dbVersion ?? "—"}`);
  }
  console.log(`Jobs:   ${jobCount}`);
  console.log(`Policies: ${policyCount}`);
  console.log(`Documents: ${documentCount}`);
}

async function cmdSync(args: string[]) {
  const { db } = await getCliContext();
  const sub = args[0];
  if (sub === "set-url" && args[1]) {
    setSyncConfig(db, "cloud_url", args[1]);
    console.log("Cloud URL set");
    return;
  }
  if (sub === "set-interval" && args[1]) {
    const ms = parseInt(args[1], 10);
    if (isNaN(ms)) {
      console.log("Usage: brainstorm sync set-interval <ms>");
      return;
    }
    setSyncConfig(db, "interval_ms", String(ms));
    console.log(`Sync interval set to ${ms}ms`);
    return;
  }
  const syncConfig = getSyncConfig(db);
  if (!syncConfig.cloudUrl) {
    console.log("No cloud URL configured. Run: brainstorm sync set-url <url>");
    return;
  }
  const result = await runCloudSync(db, syncConfig.cloudUrl);
  console.log(`Sync: sent=${result.sent} received=${result.received}`);
}

async function cmdPolicy(args: string[]) {
  const sub = args[0] ?? "list";
  const { db } = await getCliContext();

  if (sub === "list") {
    const result = await execute("policy.list", {}, { db, actor: "cli" });
    console.log(JSON.stringify(result, null, 2));
  } else if (sub === "add" && args[1]) {
    const filePath = args[1];
    const content = await Bun.file(filePath).text();
    let parsed: Record<string, unknown>;
    if (filePath.endsWith(".toml")) {
      const toml = await import("toml");
      parsed = (toml.default ?? toml).parse(content);
      if (parsed.policy && typeof parsed.policy === "object") {
        parsed = parsed.policy as Record<string, unknown>;
      }
      parsed = {
        name: parsed.name,
        effect: parsed.effect,
        priority: parsed.priority,
        actionPattern: parsed.action_pattern ?? parsed.actionPattern,
        resourcePattern: parsed.resource_pattern ?? parsed.resourcePattern,
        actorPattern: parsed.actor_pattern ?? parsed.actorPattern,
        message: parsed.message,
      };
    } else {
      parsed = JSON.parse(content);
    }
    const result = await execute("policy.add", parsed, { db, actor: "cli" });
    console.log("Added:", result);
  } else if (sub === "disable" && args[1]) {
    await execute("policy.disable", { id: args[1] }, { db, actor: "cli" });
    console.log("Disabled");
  } else {
    console.log("Usage: brainstorm policy list | add <file> | disable <id>");
  }
}

async function cmdAddFact(args: string[]) {
  const content = args.join(" ").trim();
  if (!content) {
    console.log("Usage: brainstorm add-fact \"your fact here\"");
    return;
  }
  const { db } = await getCliContext();
  const result = await execute("facts.add", { content }, { db, actor: "cli" }) as { id: string };
  console.log("Added:", result.id);
}

async function cmdSearch(args: string[]) {
  const query = args.join(" ").trim();
  if (!query) {
    console.log("Usage: brainstorm search \"your query\"");
    return;
  }
  const { db } = await getCliContext();
  const result = await execute("knowledge.search", { query, limit: 10 }, { db, actor: "cli" });
  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] ?? "help";
  const rest = args.slice(1);

  switch (cmd) {
    case "init":
      await cmdInit(rest);
      break;
    case "setup":
      await cmdSetup();
      break;
    case "serve":
      await cmdServe();
      break;
    case "status":
      await cmdStatus();
      break;
    case "sync":
      await cmdSync(rest);
      break;
    case "policy":
      await cmdPolicy(rest);
      break;
    case "add-fact":
      await cmdAddFact(rest);
      break;
    case "search":
      await cmdSearch(rest);
      break;
    case "help":
    default:
      console.log(`brainstorm — Brains CLI
Usage: brainstorm <command> [args]

Commands:
  init [path]     Create brain.toml + data dir
  setup           Download extensions + model
  serve           Start MCP server + HTTP + scheduler
  status          Show brain state, sync, jobs, policies
  sync            Trigger cloud sync (or: set-url <url>, set-interval <ms>)
  policy list     List policies
  policy add <f>  Add policy from JSON file
  policy disable <id>
  add-fact "..."  Quick fact entry
  search "..."    Quick search
`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
