import type { Database } from "bun:sqlite";

export interface Policy {
  id: string;
  name: string;
  effect: string;
  priority: number;
  actionPattern: string | null;
  resourcePattern: string | null;
  actorPattern: string | null;
  message: string | null;
  enabled: number;
  createdAt: number;
  updatedAt: number;
}

export interface NewPolicy {
  id: string;
  name: string;
  effect: string;
  priority?: number;
  actionPattern?: string | null;
  resourcePattern?: string | null;
  actorPattern?: string | null;
  message?: string | null;
  enabled?: number;
  createdAt: number;
  updatedAt: number;
}

export function insert(db: Database, p: NewPolicy): void {
  db.run(
    `INSERT INTO policies (id, name, effect, priority, action_pattern, resource_pattern, actor_pattern, message, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.id,
      p.name,
      p.effect,
      p.priority ?? 0,
      p.actionPattern ?? null,
      p.resourcePattern ?? null,
      p.actorPattern ?? null,
      p.message ?? null,
      p.enabled ?? 1,
      p.createdAt,
      p.updatedAt,
    ]
  );
}

export function list(db: Database, options?: { enabledOnly?: boolean }): Policy[] {
  let sql = `SELECT id, name, effect, priority, action_pattern as actionPattern, resource_pattern as resourcePattern, actor_pattern as actorPattern, message, enabled, created_at as createdAt, updated_at as updatedAt FROM policies`;
  const params: unknown[] = [];
  if (options?.enabledOnly) {
    sql += " WHERE enabled = 1";
  }
  sql += " ORDER BY priority DESC, created_at ASC";
  return db.query(sql).all(...params) as Policy[];
}

export function getById(db: Database, id: string): Policy | null {
  const row = db
    .query(
      `SELECT id, name, effect, priority, action_pattern as actionPattern, resource_pattern as resourcePattern, actor_pattern as actorPattern, message, enabled, created_at as createdAt, updated_at as updatedAt FROM policies WHERE id = ?`
    )
    .get(id) as Policy | undefined;
  return row ?? null;
}

export function setEnabled(db: Database, id: string, enabled: number): void {
  db.run("UPDATE policies SET enabled = ?, updated_at = ? WHERE id = ?", [
    enabled,
    Date.now(),
    id,
  ]);
}
