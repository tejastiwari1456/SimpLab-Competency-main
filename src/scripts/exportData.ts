import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { resolvePostgresPoolConfig } from "../db/config";

export const EXPORT_TABLE_ORDER = [
  "users",
  "classes",
  "class_students",
  "class_enrollments",
  "assignments",
  "viva_sessions",
  "viva_responses",
  "submissions",
  "student_competencies",
  "competency_history",
  "evaluation_history",
  "notification_reads",
  "notifications",
] as const;

export type ExportTableName = (typeof EXPORT_TABLE_ORDER)[number];

export interface DatabaseSnapshot {
  version: number;
  exportedAt: string;
  tables: Record<ExportTableName, Record<string, unknown>[]>;
}

const BACKUP_DIR = path.resolve(process.cwd(), ".local-backup");

export function resolveSafeBackupPath(fileName = "simlab-snapshot.json"): string {
  const safeBaseName = path.basename(fileName);
  const resolved = path.resolve(BACKUP_DIR, safeBaseName);
  if (!resolved.startsWith(BACKUP_DIR + path.sep)) {
    throw new Error("Invalid backup path: must reside inside .local-backup/");
  }
  return resolved;
}

async function exportDatabase() {
  const pool = new Pool(resolvePostgresPoolConfig(process.env, { maxOverride: 3 }));
  const targetFile = resolveSafeBackupPath(process.argv[2] || "simlab-snapshot.json");

  try {
    const client = await pool.connect();
    try {
      const tables = {} as Record<ExportTableName, Record<string, unknown>[]>;

      for (const tableName of EXPORT_TABLE_ORDER) {
        try {
          const result = await client.query(`SELECT * FROM ${tableName}`);
          tables[tableName] = result.rows;
        } catch (err: any) {
          if (err?.code === "42P01") {
            tables[tableName] = [];
          } else {
            throw err;
          }
        }
      }

      const snapshot: DatabaseSnapshot = {
        version: 1,
        exportedAt: new Date().toISOString(),
        tables,
      };

      fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
      fs.writeFileSync(targetFile, JSON.stringify(snapshot, null, 2), {
        encoding: "utf8",
        mode: 0o600,
      });

      console.log("[Export] Snapshot written securely to .local-backup/" + path.basename(targetFile));
      for (const tableName of EXPORT_TABLE_ORDER) {
        console.log(`  - ${tableName}: ${tables[tableName].length} row(s)`);
      }
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  process.argv[1].replace(/\\/g, "/").endsWith("exportData.ts");

if (isDirectRun) {
  exportDatabase().catch((err) => {
    console.error("[Export] Failed:", err?.message || err);
    process.exitCode = 1;
  });
}
