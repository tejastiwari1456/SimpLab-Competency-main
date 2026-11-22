import "dotenv/config";
import { Pool } from "pg";
import fs from "node:fs";
import path from "node:path";
import { resolvePostgresPoolConfig } from "../db/config";

export async function runMigrations() {
  const pool = new Pool(
    resolvePostgresPoolConfig(process.env, { preferAdmin: true, maxOverride: 5 })
  );

  try {
    const client = await pool.connect();

    try {
      const dbInfo = await client.query(
        "SELECT current_database() AS database, current_user AS username"
      );
      console.log("Connected to:", dbInfo.rows[0].database);
      console.log("Database user:", dbInfo.rows[0].username);

      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          filename VARCHAR(255) PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const migrationsDir = path.resolve(process.cwd(), "migrations");
      if (!fs.existsSync(migrationsDir)) {
        throw new Error(`Migrations directory not found: ${migrationsDir}`);
      }

      const files = fs
        .readdirSync(migrationsDir)
        .filter((file) => /^\d+_[\w-]+\.sql$/.test(file))
        .sort();

      for (const filename of files) {
        const alreadyApplied = await client.query(
          "SELECT 1 FROM schema_migrations WHERE filename = $1",
          [filename]
        );
        if (alreadyApplied.rowCount) {
          console.log(`Skipping ${filename} (already applied).`);
          continue;
        }

        const sql = fs.readFileSync(path.join(migrationsDir, filename), "utf8");
        console.log(`Applying ${filename}...`);

        await client.query("BEGIN");
        try {
          await client.query(sql);
          await client.query(
            "INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING",
            [filename]
          );
          await client.query("COMMIT");
          console.log(`Applied successfully: ${filename}`);
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }

      console.log("Migration process completed.");
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

runMigrations().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exitCode = 1;
});
