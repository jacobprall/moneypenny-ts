/**
 * Tool resolution — merge brain tools, skill tool for session.
 */

import type { Database } from "bun:sqlite";
import type { CoreTool } from "ai";
import { createBrainTools } from "../tool/registry";
import { createSkillTool } from "../tool/skill";
import { discoverSkills } from "../skill";

export interface ResolveToolsInput {
  db: Database;
  sessionId: string;
  messageId: string;
  actor: string;
}

export async function resolveTools(input: ResolveToolsInput) {
  const ctx = {
    db: input.db,
    sessionId: input.sessionId,
    messageId: input.messageId,
    callId: "", // set per call
    actor: input.actor,
  };

  const tools = {
    ...createBrainTools(ctx),
  } as Record<string, CoreTool>;

  const skills = await discoverSkills();
  if (skills.length > 0) {
    tools.skill = createSkillTool() as CoreTool;
  }

  return tools;
}
