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

  for await (const chunk of stream.fullStream) {
    switch (chunk.type) {
      case "text-delta":
        if (!textPartId) {
          const part = Session.insertPart(db, assistantMessageId, sessionId, "text", { text: "" });
          textPartId = part.id;
        }
        textBuffer += chunk.textDelta;
        Session.updatePartText(db, textPartId, textBuffer);
        onTextDelta?.(chunk.textDelta);
        break;

      case "reasoning":
        if (chunk.textDelta) {
          Session.insertPart(db, assistantMessageId, sessionId, "reasoning", {
            text: chunk.textDelta,
            metadata: JSON.stringify(chunk),
          });
        }
        break;

      case "tool-call-streaming-start":
        if (!(chunk.toolCallId in toolParts)) {
          const part = Session.insertPart(db, assistantMessageId, sessionId, "tool", {
            tool: chunk.toolName,
            toolCallId: chunk.toolCallId,
            state: { status: "pending", input: {} },
          });
          toolParts[chunk.toolCallId] = part.id;
        }
        break;

      case "tool-call": {
        const tc = chunk as { toolCallId: string; toolName: string; args?: unknown };
        if (tc.toolCallId in toolParts) {
          const partId = toolParts[tc.toolCallId];
          const argsStr = JSON.stringify(tc.args ?? {});
          recentToolCalls.push({ tool: tc.toolName, args: argsStr });
          const lastThree = recentToolCalls.slice(-DOOM_LOOP_THRESHOLD);
          if (
            lastThree.length === DOOM_LOOP_THRESHOLD &&
            lastThree.every((t) => t.tool === tc.toolName && t.args === argsStr)
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
        const tr = chunk as { toolCallId: string; result?: unknown };
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

      case "finish":
        Session.updateMessageFinish(
          db,
          assistantMessageId,
          chunk.finishReason,
          chunk.usage?.promptTokens,
          chunk.usage?.completionTokens
        );
        return blocked ? "stop" : chunk.finishReason === "tool-calls" ? "continue" : "stop";

      case "error":
        Session.updateMessageFinish(db, assistantMessageId, "error");
        throw chunk.error;

      default:
        break;
    }
  }

  return "stop";
}
