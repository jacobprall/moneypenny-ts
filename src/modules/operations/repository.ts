import type { Database, SQLQueryBindings } from "bun:sqlite";

export interface OperationScript {
  id: string;
  name: string;
  description: string | null;
  inputSchema: string | null;
  script: string;
  enabled: number;
  createdAt: number;
  updatedAt: number;
}

export interface NewOperationScript {
  id: string;
  name: string;
  description?: string | null;
  inputSchema?: string | null;
  script: string;
  enabled?: number;
  createdAt: number;
  updatedAt: number;
}

export function insert(db: Database, o: NewOperationScript): void {
  db.run(
    `INSERT INTO operation_scripts (id, name, description, input_schema, script, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      o.id,
      o.name,
      o.description ?? null,
      o.inputSchema ?? null,
      o.script,
      o.enabled ?? 1,
      o.createdAt,
      o.updatedAt,
    ]
  );
}

export function list(db: Database, options?: { enabledOnly?: boolean }): OperationScript[] {
  let sql = `SELECT id, name, description, input_schema as inputSchema, script, enabled, created_at as createdAt, updated_at as updatedAt FROM operation_scripts`;
  const params: unknown[] = [];
  if (options?.enabledOnly) {
    sql += " WHERE enabled = 1";
  }
  sql += " ORDER BY name";
  return db.query(sql).all(...(params as SQLQueryBindings[])) as OperationScript[];
}

export function getByName(db: Database, name: string): OperationScript | null {
  const row = db
    .query(
      `SELECT id, name, description, input_schema as inputSchema, script, enabled, created_at as createdAt, updated_at as updatedAt FROM operation_scripts WHERE name = ? AND enabled = 1`
    )
    .get(name) as OperationScript | undefined;
  return row ?? null;
}

export function setEnabled(db: Database, id: string, enabled: number): void {
  db.run("UPDATE operation_scripts SET enabled = ?, updated_at = ? WHERE id = ?", [
    enabled,
    Date.now(),
    id,
  ]);
}

export function remove(db: Database, id: string): void {
  db.run("DELETE FROM operation_scripts WHERE id = ?", [id]);
}
