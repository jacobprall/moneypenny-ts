import type { Database } from "bun:sqlite";

export interface Hook {
  id: string;
  name: string;
  phase: string;
  matchPattern: string;
  priority: number;
  script: string;
  enabled: number;
  createdAt: number;
  updatedAt: number;
}

export interface NewHook {
  id: string;
  name: string;
  phase: string;
  matchPattern: string;
  priority?: number;
  script: string;
  enabled?: number;
  createdAt: number;
  updatedAt: number;
}

export function insert(db: Database, h: NewHook): void {
  db.run(
    `INSERT INTO hooks (id, name, phase, match_pattern, priority, script, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      h.id,
      h.name,
      h.phase,
      h.matchPattern,
      h.priority ?? 0,
      h.script,
      h.enabled ?? 1,
      h.createdAt,
      h.updatedAt,
    ]
  );
}

export function list(db: Database, options?: { phase?: string }): Hook[] {
  let sql = `SELECT id, name, phase, match_pattern as matchPattern, priority, script, enabled, created_at as createdAt, updated_at as updatedAt FROM hooks`;
  const params: unknown[] = [];
  if (options?.phase) {
    sql += " WHERE phase = ?";
    params.push(options.phase);
  }
  sql += " ORDER BY phase, priority DESC";
  return db.query(sql).all(...params) as Hook[];
}

export function setEnabled(db: Database, id: string, enabled: number): void {
  db.run("UPDATE hooks SET enabled = ?, updated_at = ? WHERE id = ?", [
    enabled,
    Date.now(),
    id,
  ]);
}
