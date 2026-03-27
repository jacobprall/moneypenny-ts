/**
 * Instruction files — AGENTS.md, CLAUDE.md discovery.
 */

import { existsSync, readFileSync } from "fs";
import { join, resolve, dirname } from "path";
import { homedir } from "os";

const FILES = ["AGENTS.md", "CLAUDE.md", "CONTEXT.md"];

function findUp(dir: string, root: string): string[] {
  const found: string[] = [];
  let current = resolve(dir);
  const rootResolved = resolve(root);
  while (current.startsWith(rootResolved) || current === rootResolved) {
    for (const name of FILES) {
      const p = join(current, name);
      if (existsSync(p)) found.push(p);
    }
    if (found.length > 0) return found;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return found;
}

function globalPaths(): string[] {
  const paths: string[] = [];
  const moneypenny = join(homedir(), ".config", "moneypenny", "AGENTS.md");
  if (existsSync(moneypenny)) paths.push(moneypenny);
  const claude = join(homedir(), ".claude", "CLAUDE.md");
  if (existsSync(claude)) paths.push(claude);
  return paths;
}

export function findInstructionFiles(): string[] {
  const cwd = process.cwd();
  const project = findUp(cwd, cwd);
  const global = globalPaths();
  const seen = new Set<string>();
  const result: string[] = [];
  for (const p of [...project, ...global]) {
    const abs = resolve(p);
    if (!seen.has(abs)) {
      seen.add(abs);
      result.push(abs);
    }
  }
  return result;
}

export function loadInstructions(paths: string[]): string {
  const parts: string[] = [];
  for (const p of paths) {
    try {
      const content = readFileSync(p, "utf-8");
      if (content.trim()) parts.push(`Instructions from ${p}:\n${content}`);
    } catch {
      // skip
    }
  }
  return parts.join("\n\n");
}
