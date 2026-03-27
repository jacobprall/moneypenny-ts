/**
 * Session CRUD — sessions, messages, parts.
 */

import type { Database } from "bun:sqlite";

export interface Session {
  id: string;
  parentId: string | null;
  projectId: string | null;
  directory: string | null;
  title: string | null;
  summary: string | null;
  agent: string;
  mode: string;
  status: string;
  modelProvider: string | null;
  modelId: string | null;
  permission: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  sessionId: string;
  role: string;
  agent: string | null;
  model: string | null;
  tokensInput: number;
  tokensOutput: number;
  finish: string | null;
  error: string | null;
  summary: string | null;
  createdAt: number;
}

export interface Part {
  id: string;
  messageId: string;
  sessionId: string;
  type: string;
  text: string | null;
  tool: string | null;
  toolCallId: string | null;
  state: string | null;
  metadata: string | null;
  createdAt: number;
}

export interface CreateSessionOptions {
  parentId?: string | null;
  projectId?: string | null;
  directory?: string | null;
  title?: string | null;
  agent?: string;
  mode?: string;
}

export function create(db: Database, opts: CreateSessionOptions = {}): Session {
  const id = crypto.randomUUID();
  const now = Date.now();
  const row = {
    id,
    parent_id: opts.parentId ?? null,
    project_id: opts.projectId ?? null,
    directory: opts.directory ?? null,
    title: opts.title ?? null,
    summary: null,
    agent: opts.agent ?? "build",
    mode: opts.mode ?? "foreground",
    status: "idle",
    model_provider: null,
    model_id: null,
    permission: null,
    created_at: now,
    updated_at: now,
  };
  db.run(
    `INSERT INTO sessions (id, parent_id, project_id, directory, title, summary, agent, mode, status, model_provider, model_id, permission, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.parent_id,
      row.project_id,
      row.directory,
      row.title,
      row.summary,
      row.agent,
      row.mode,
      row.status,
      row.model_provider,
      row.model_id,
      row.permission,
      row.created_at,
      row.updated_at,
    ]
  );
  return toSession(row);
}

export function get(db: Database, id: string): Session | null {
  const row = db
    .query(
      `SELECT id, parent_id as parentId, project_id as projectId, directory, title, summary, agent, mode, status, model_provider as modelProvider, model_id as modelId, permission, created_at as createdAt, updated_at as updatedAt
       FROM sessions WHERE id = ?`
    )
    .get(id) as Record<string, unknown> | undefined;
  return row ? toSession(row) : null;
}

export function setStatus(db: Database, id: string, status: string): void {
  const now = Date.now();
  db.run("UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?", [status, now, id]);
}

export function insertMessage(
  db: Database,
  sessionId: string,
  role: string,
  opts: { agent?: string; model?: string } = {}
): Message {
  const id = crypto.randomUUID();
  const now = Date.now();
  db.run(
    `INSERT INTO messages (id, session_id, role, agent, model, tokens_input, tokens_output, finish, error, summary, created_at)
     VALUES (?, ?, ?, ?, ?, 0, 0, NULL, NULL, NULL, ?)`,
    [id, sessionId, role, opts.agent ?? null, opts.model ?? null, now]
  );
  return {
    id,
    sessionId,
    role,
    agent: opts.agent ?? null,
    model: opts.model ?? null,
    tokensInput: 0,
    tokensOutput: 0,
    finish: null,
    error: null,
    summary: null,
    createdAt: now,
  };
}

export function getMessages(db: Database, sessionId: string): Message[] {
  return db
    .query(
      `SELECT id, session_id as sessionId, role, agent, model, tokens_input as tokensInput, tokens_output as tokensOutput, finish, error, summary, created_at as createdAt
       FROM messages WHERE session_id = ? ORDER BY created_at ASC`
    )
    .all(sessionId) as Message[];
}

export function insertPart(
  db: Database,
  messageId: string,
  sessionId: string,
  type: string,
  data: { text?: string; tool?: string; toolCallId?: string; state?: string; metadata?: string } = {}
): Part {
  const id = crypto.randomUUID();
  const now = Date.now();
  db.run(
    `INSERT INTO parts (id, message_id, session_id, type, text, tool, tool_call_id, state, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      messageId,
      sessionId,
      type,
      data.text ?? null,
      data.tool ?? null,
      data.toolCallId ?? null,
      data.state ? JSON.stringify(data.state) : null,
      data.metadata ? JSON.stringify(data.metadata) : null,
      now,
    ]
  );
  return {
    id,
    messageId,
    sessionId,
    type,
    text: data.text ?? null,
    tool: data.tool ?? null,
    toolCallId: data.toolCallId ?? null,
    state: data.state ? JSON.stringify(data.state) : null,
    metadata: data.metadata ? JSON.stringify(data.metadata) : null,
    createdAt: now,
  };
}

export function getParts(db: Database, messageId: string): Part[] {
  return db
    .query(
      `SELECT id, message_id as messageId, session_id as sessionId, type, text, tool, tool_call_id as toolCallId, state, metadata, created_at as createdAt
       FROM parts WHERE message_id = ? ORDER BY created_at ASC`
    )
    .all(messageId) as Part[];
}

export function updatePartText(db: Database, partId: string, text: string): void {
  db.run("UPDATE parts SET text = ? WHERE id = ?", [text, partId]);
}

export function updatePartState(db: Database, partId: string, state: Record<string, unknown>): void {
  db.run("UPDATE parts SET state = ? WHERE id = ?", [JSON.stringify(state), partId]);
}

export function updateMessageFinish(
  db: Database,
  messageId: string,
  finish: string,
  tokensInput?: number,
  tokensOutput?: number
): void {
  const updates: string[] = ["finish = ?"];
  const vals: unknown[] = [finish];
  if (tokensInput !== undefined) {
    updates.push("tokens_input = ?");
    vals.push(tokensInput);
  }
  if (tokensOutput !== undefined) {
    updates.push("tokens_output = ?");
    vals.push(tokensOutput);
  }
  vals.push(messageId);
  db.run(`UPDATE messages SET ${updates.join(", ")} WHERE id = ?`, vals);
}

function toSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    parentId: (row.parentId ?? row.parent_id) as string | null,
    projectId: (row.projectId ?? row.project_id) as string | null,
    directory: row.directory as string | null,
    title: row.title as string | null,
    summary: row.summary as string | null,
    agent: row.agent as string,
    mode: row.mode as string,
    status: row.status as string,
    modelProvider: (row.modelProvider ?? row.model_provider) as string | null,
    modelId: (row.modelId ?? row.model_id) as string | null,
    permission: row.permission as string | null,
    createdAt: (row.createdAt ?? row.created_at) as number,
    updatedAt: (row.updatedAt ?? row.updated_at) as number,
  };
}
