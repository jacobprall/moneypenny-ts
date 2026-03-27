/**
 * Session processor — consumes LLM stream, updates parts, handles tool calls, doom loop.
 */

import type { Database } from "bun:sqlite";
import * as Session from "./index";
import type { StreamResult } from "./llm";

const DOOM_LOOP_THRESHOLD = 3;

export type ProcessResult = "stop" | "continue" | "compact";

export interface ProcessInput {
  db: Database;
  sessionId: string;
  assistantMessageId: string;
  stream: StreamResult;
  onTextDelta?: (text: string) => void;
}

export async function process(input: ProcessInput): Promise<ProcessResult> {
  const { db, sessionId, assistantMessageId, stream, onTextDelta } = input;

  let textPartId: string | null = null;
  let textBuffer = "";
  const toolParts: Record<string, string> = {};
  const recentToolCalls: Array<{ tool: string; args: string }> = [];
  let blocked = false;

  for await (const raw of stream.fullStream) {
    // Stream chunk shapes vary by AI SDK version; treat as a loose record per branch.
    const chunk = raw as Record<string, unknown> & { type: string };
    switch (chunk.type) {
      case "text-delta":
        if (!textPartId) {
          const part = Session.insertPart(db, assistantMessageId, sessionId, "text", { text: "" });
          textPartId = part.id;
        }
        {
          const delta = String(chunk.textDelta ?? "");
          textBuffer += delta;
          Session.updatePartText(db, textPartId, textBuffer);
          onTextDelta?.(delta);
        }
        break;

      case "reasoning":
        {
          const delta = chunk.textDelta;
          if (delta) {
            Session.insertPart(db, assistantMessageId, sessionId, "reasoning", {
              text: String(delta),
              metadata: JSON.stringify(chunk),
            });
          }
        }
        break;

      case "tool-call-streaming-start":
        {
          const toolCallId = String(chunk.toolCallId ?? "");
          if (toolCallId && !(toolCallId in toolParts)) {
            const part = Session.insertPart(db, assistantMessageId, sessionId, "tool", {
              tool: String(chunk.toolName ?? ""),
              toolCallId,
              state: { status: "pending", input: {} },
            });
            toolParts[toolCallId] = part.id;
          }
        }
        break;

      case "tool-call": {
        const tc = chunk as unknown as { toolCallId: string; toolName: string; args?: unknown };
        if (tc.toolCallId in toolParts) {
          const partId = toolParts[tc.toolCallId];
          const argsStr = JSON.stringify(tc.args ?? {});
          recentToolCalls.push({ tool: tc.toolName, args: argsStr });
          const lastThree = recentToolCalls.slice(-DOOM_LOOP_THRESHOLD);
          if (
            lastThree.length === DOOM_LOOP_THRESHOLD &&
            lastThree.every((c) => c.tool === tc.toolName && c.args === argsStr)
          ) {
            blocked = true;
          }
          Session.updatePartState(db, partId, {
            status: "running",
            input: tc.args ?? {},
          });
        }
        break;
      }

      case "tool-result": {
        const tr = chunk as unknown as { toolCallId: string; result?: unknown };
        if (tr.toolCallId in toolParts) {
          const partId = toolParts[tr.toolCallId];
          const output = tr.result;
          Session.updatePartState(db, partId, {
            status: "completed",
            output: output ?? null,
          });
          delete toolParts[tr.toolCallId];
        }
        break;
      }

      case "finish": {
        const usage = chunk.usage as { promptTokens?: number; completionTokens?: number } | undefined;
        const finishReason = String(chunk.finishReason ?? "stop");
        Session.updateMessageFinish(
          db,
          assistantMessageId,
          finishReason,
          usage?.promptTokens,
          usage?.completionTokens
        );
        return blocked ? "stop" : finishReason === "tool-calls" ? "continue" : "stop";
      }

      case "error": {
        Session.updateMessageFinish(db, assistantMessageId, "error");
        const err = chunk.error;
        throw err instanceof Error ? err : new Error(String(err));
      }

      default:
        break;
    }
  }

  return "stop";
}
