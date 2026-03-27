/**
 * Skill discovery — SKILL.md in .claude/skills, .agents/skills, .moneypenny/skills.
 */

import { existsSync, readFileSync, readdirSync } from "fs";
import { join, resolve } from "path";

export interface SkillInfo {
  name: string;
  description: string;
  location: string;
  content: string;
}

const SKILL_DIRS = [".claude/skills", ".agents/skills", ".moneypenny/skills"];

function parseFrontmatter(content: string): { name?: string; description?: string; body: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return { body: content };
  const fm = match[1];
  const body = match[2];
  let name: string | undefined;
  let description: string | undefined;
  for (const line of fm.split("\n")) {
    const n = line.match(/^name:\s*(.+)$/);
    if (n) name = n[1].trim().replace(/^["']|["']$/g, "");
    const d = line.match(/^description:\s*(.+)$/);
    if (d) description = d[1].trim().replace(/^["']|["']$/g, "");
  }
  return { name, description, body };
}

function walkSkills(dir: string): SkillInfo[] {
  const result: SkillInfo[] = [];
  if (!existsSync(dir)) return result;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        result.push(...walkSkills(p));
      } else if (e.name === "SKILL.md") {
        try {
          const raw = readFileSync(p, "utf-8");
          const { name, description, body } = parseFrontmatter(raw);
          result.push({
            name: name ?? e.name,
            description: description ?? "No description",
            location: resolve(p),
            content: body.trim(),
          });
        } catch {
          // skip invalid
        }
      }
    }
  } catch {
    // skip
  }
  return result;
}

export async function discoverSkills(): Promise<SkillInfo[]> {
  const cwd = process.cwd();
  const seen = new Map<string, SkillInfo>();
  for (const rel of SKILL_DIRS) {
    const dir = join(cwd, rel);
    for (const s of walkSkills(dir)) {
      const key = s.location;
      if (!seen.has(key)) seen.set(key, s);
    }
  }
  return Array.from(seen.values());
}

export function formatSkillsList(skills: SkillInfo[]): string {
  if (skills.length === 0) return "No skills available.";
  return [
    "<available_skills>",
    ...skills.map(
      (s) =>
        `  <skill>\n    <name>${s.name}</name>\n    <description>${s.description}</description>\n    <location>${s.location}</location>\n  </skill>`
    ),
    "</available_skills>",
  ].join("\n");
}

export async function getSkill(name: string): Promise<SkillInfo | undefined> {
  const all = await discoverSkills();
  return all.find((s) => s.name === name);
}
