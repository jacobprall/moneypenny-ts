/**
 * Session loop — run LLM, process stream, handle messages.
 */

import type { Database } from "bun:sqlite";
import type { CoreMessage } from "ai";
import type { BrainConfig } from "../core/config";
import * as Session from "./index";
import { stream } from "./llm";
import { process as processStream } from "./processor";
import { assemble as assembleSystemPrompt } from "./system";
import { resolveTools } from "./tools";

export interface RunLoopInput {
  db: Database;
  sessionId: string;
  config: BrainConfig;
  userMessage: string;
  abort?: AbortSignal;
  onTextDelta?: (text: string) => void;
}

export async function runLoop(input: RunLoopInput): Promise<void> {
  const { db, sessionId, config, userMessage, abort, onTextDelta } = input;

  const sess = Session.get(db, sessionId);
  if (!sess) throw new Error(`Session not found: ${sessionId}`);

  Session.setStatus(db, sessionId, "busy");

  try {
    // 1. Create user message
    const userMsg = Session.insertMessage(db, sessionId, "user");
    Session.insertPart(db, userMsg.id, sessionId, "text", { text: userMessage });

    // 2. Create assistant message
    const assistantMsg = Session.insertMessage(db, sessionId, "assistant", {
      agent: sess.agent,
      model: sess.modelId ?? undefined,
    });

    // 3. Build messages for LLM
    const messages: CoreMessage[] = [{ role: "user", content: userMessage }];

    const systemPrompt = await assembleSystemPrompt(db, sessionId, userMessage);
    const tools = await resolveTools({
      db,
      sessionId,
      messageId: assistantMsg.id,
      actor: sess.agent,
    });

    // 4. Stream and process
    const result = await stream({
      model: config,
      system: systemPrompt,
      messages,
      tools,
      abort,
    });

    await processStream({
      db,
      sessionId,
      assistantMessageId: assistantMsg.id,
      stream: result,
      onTextDelta,
    });
  } finally {
    Session.setStatus(db, sessionId, "idle");
  }
}
