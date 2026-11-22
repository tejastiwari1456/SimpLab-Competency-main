import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { resolvePostgresPoolConfig } from "../db/config";
import type { DatabaseSnapshot, ExportTableName } from "./exportData";

// Strict allowlist of valid tables and columns to prevent SQL identifier injection
const ALLOWED_TABLE_COLUMNS: Record<ExportTableName, readonly string[]> = {
  users: [
    "id",
    "firebase_uid",
    "email",
    "password_hash",
    "name",
    "role",
    "status",
    "institution",
    "enrollment_code",
    "last_login_at",
    "created_at",
    "updated_at",
  ],
  classes: [
    "id",
    "name",
    "code",
    "department",
    "semester",
    "academic_year",
    "teacher_id",
    "average_competencies",
    "common_misconceptions",
    "created_at",
    "updated_at",
  ],
  class_students: ["class_id", "student_id", "enrolled_at"],
  class_enrollments: [
    "id",
    "student_id",
    "class_id",
    "enrollment_status",
    "enrolled_at",
    "created_at",
    "updated_at",
  ],
  assignments: [
    "id",
    "class_id",
    "title",
    "experiment_id",
    "due_date",
    "total_marks",
    "weight_towards_internal",
    "attempts_allowed",
    "allow_free_exploration",
    "evaluation_criteria",
    "status",
    "created_by",
    "created_at",
  ],
  viva_sessions: [
    "id",
    "student_id",
    "experiment_id",
    "assignment_id",
    "attempt_number",
    "status",
    "overall_score",
    "max_score",
    "questions_count",
    "answered_count",
    "summary_feedback",
    "started_at",
    "completed_at",
    "created_at",
  ],
  viva_responses: [
    "id",
    "session_id",
    "question_index",
    "task_id",
    "question_text",
    "competency_dimension",
    "rubric",
    "student_answer",
    "score",
    "max_points",
    "passed",
    "ai_feedback",
    "rubric_criteria_met",
    "missing_concepts",
    "adaptive_follow_up",
    "difficulty",
    "ai_model",
    "created_at",
  ],
  submissions: [
    "id",
    "assignment_id",
    "student_id",
    "student_name",
    "experiment_id",
    "submitted_at",
    "attempt_number",
    "total_score",
    "max_score",
    "competency_scores",
    "task_responses",
    "observations",
    "calculated_results",
    "data_readings_count",
    "completion_status",
    "evaluation_status",
    "viva_session_id",
    "faculty_score",
    "instructor_feedback",
    "evaluated_by",
    "evaluated_at",
    "created_at",
  ],
  student_competencies: [
    "id",
    "student_id",
    "competency_key",
    "score",
    "experiment_contribution",
    "viva_contribution",
    "experiments_evaluated",
    "status",
    "updated_at",
  ],
  competency_history: [
    "id",
    "student_id",
    "submission_id",
    "viva_session_id",
    "experiment_id",
    "attempt_number",
    "competency_scores",
    "overall_score",
    "delta_overall",
    "calculation_metadata",
    "recorded_at",
  ],
  evaluation_history: [
    "id",
    "submission_id",
    "evaluator_id",
    "evaluator_name",
    "previous_status",
    "new_status",
    "previous_score",
    "new_score",
    "feedback",
    "created_at",
  ],
  notification_reads: ["user_id", "notification_key", "read_at"],
  notifications: [
    "id",
    "recipient_user_id",
    "recipient_role",
    "type",
    "title",
    "message",
    "metadata",
    "is_read",
    "read_at",
    "created_at",
  ],
};

const JSONB_COLUMNS = new Set([
  "average_competencies",
  "common_misconceptions",
  "evaluation_criteria",
  "rubric_criteria_met",
  "missing_concepts",
  "competency_scores",
  "task_responses",
  "observations",
  "calculated_results",
  "calculation_metadata",
  "metadata",
]);

const TABLE_ORDER = Object.keys(ALLOWED_TABLE_COLUMNS) as ExportTableName[];
const BACKUP_DIR = path.resolve(process.cwd(), ".local-backup");

function resolveSafeSnapshotFile(fileName = "simlab-snapshot.json"): string {
  const safeBaseName = path.basename(fileName);
  const resolved = path.resolve(BACKUP_DIR, safeBaseName);
  if (!resolved.startsWith(BACKUP_DIR + path.sep)) {
    throw new Error("Invalid snapshot path: must reside inside .local-backup/");
  }
  return resolved;
}

async function importDatabase() {
  const snapshotPath = resolveSafeSnapshotFile(process.argv[2] || "simlab-snapshot.json");
  if (!fs.existsSync(snapshotPath)) {
    throw new Error(
      `Snapshot file not found at .local-backup/${path.basename(snapshotPath)}. Run 'npm run db:export' first.`
    );
  }

  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8")) as DatabaseSnapshot;
  if (!snapshot || typeof snapshot !== "object" || !snapshot.tables) {
    throw new Error("Invalid snapshot format.");
  }

  const pool = new Pool(resolvePostgresPoolConfig(process.env, { maxOverride: 3 }));

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const tableName of TABLE_ORDER) {
        const rows = Array.isArray(snapshot.tables[tableName]) ? snapshot.tables[tableName] : [];
        if (rows.length === 0) {
          console.log(`  - ${tableName}: 0 rows (skipped)`);
          continue;
        }

        const allowedCols = ALLOWED_TABLE_COLUMNS[tableName];
        let inserted = 0;

        for (const row of rows) {
          const presentCols = allowedCols.filter(
            (col) => Object.prototype.hasOwnProperty.call(row, col) && row[col] !== undefined
          );
          if (presentCols.length === 0) continue;

          const placeholders = presentCols.map((_, idx) => `$${idx + 1}`).join(", ");
          const values = presentCols.map((col) => {
            const val = row[col];
            if (val === null) return null;
            if (JSONB_COLUMNS.has(col) && typeof val !== "string") {
              return JSON.stringify(val);
            }
            return val;
          });

          const sqlText = `INSERT INTO ${tableName} (${presentCols.join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
          const res = await client.query(sqlText, values);
          inserted += res.rowCount || 0;
        }

        console.log(`  - ${tableName}: imported ${inserted}/${rows.length} row(s)`);
      }

      await client.query("COMMIT");
      console.log("[Import] Database snapshot imported cleanly.");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

importDatabase().catch((err) => {
  console.error("[Import] Failed:", err?.message || err);
  process.exitCode = 1;
});
