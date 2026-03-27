/**
 * Skill tool — load SKILL.md content into context.
 */

import { tool } from "ai";
import { z } from "zod";
import { getSkill, discoverSkills, formatSkillsList } from "../skill";

export function createSkillTool() {
  return tool({
    description: `Load a specialized skill. Use when a task matches an available skill.`,
    parameters: z.object({
      name: z.string().describe("Skill name from available_skills"),
    }),
    execute: async (args) => {
      const skill = await getSkill(args.name);
      if (!skill) {
        const all = await discoverSkills();
        const names = all.map((s) => s.name).join(", ");
        throw new Error(`Skill "${args.name}" not found. Available: ${names || "none"}`);
      }
      return {
        output: [
          `<skill_content name="${skill.name}">`,
          `# ${skill.name}`,
          "",
          skill.content,
          "",
          `</skill_content>`,
        ].join("\n"),
      };
    },
  });
}

export function getSkillToolDescription(): string {
  return "Use the skill tool to load instructions when a task matches an available skill.";
}
