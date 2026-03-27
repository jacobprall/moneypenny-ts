/**
 * System prompt assembly — environment, brain, skills, instructions.
 */

import type { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { context as brainContext } from "./brain-prompt";
import { findInstructionFiles, loadInstructions } from "./instruction";
import { discoverSkills, formatSkillsList } from "../skill";

export async function environment(): Promise<string> {
  const cwd = process.cwd();
  const lines = [
    "<env>",
    `  Working directory: ${cwd}`,
    `  Platform: ${process.platform}`,
    `  Date: ${new Date().toISOString().slice(0, 10)}`,
    "</env>",
  ];
  return lines.join("\n");
}

export async function brain(
  db: Database,
  sessionId: string,
  userMessage: string
): Promise<string> {
  return brainContext(db, sessionId, userMessage);
}

export async function skills(): Promise<string> {
  const skills = await discoverSkills();
  if (skills.length === 0) return "";
  return [
    "",
    "Skills provide specialized instructions. Use the skill tool to load a skill when a task matches its description.",
    formatSkillsList(skills),
  ].join("\n");
}

export async function instructions(): Promise<string> {
  const paths = findInstructionFiles();
  return loadInstructions(paths);
}

export async function assemble(
  db: Database,
  sessionId: string,
  userMessage: string,
  basePrompt?: string
): Promise<string> {
  const parts: string[] = [];

  parts.push(await environment());
  const brainBlock = await brain(db, sessionId, userMessage);
  if (brainBlock) parts.push(brainBlock);
  const skillsBlock = await skills();
  if (skillsBlock) parts.push(skillsBlock);
  const instructionsBlock = await instructions();
  if (instructionsBlock) parts.push(instructionsBlock);
  if (basePrompt) parts.push(basePrompt);

  return parts.filter(Boolean).join("\n\n");
}
