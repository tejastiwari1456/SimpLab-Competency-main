
import "dotenv/config";
import { Pool } from "pg";
import fs from "node:fs";
import path from "node:path";

async function main() {
  // Connect directly to the real PostgreSQL database.
  // This script deliberately does not use SimLab's in-memory fallback.
  const pool = new Pool(
    process.env.DATABASE_URL
      ? {
          connectionString: process.env.DATABASE_URL,
          connectionTimeoutMillis: 5000,
        }
      : {
          host: process.env.SQL_HOST || "127.0.0.1",
          port: Number(process.env.SQL_PORT || process.env.PGPORT || 5432),
          database: process.env.SQL_DB_NAME || "simlab",
          user: process.env.SQL_USER || "postgres",
          password: process.env.SQL_PASSWORD,
          connectionTimeoutMillis: 5000,
        }
  );

  try {
    const client = await pool.connect();

    try {
      const db = await client.query(
        "SELECT current_database() AS database, current_user AS username"
      );

      console.log("Connected to:", db.rows[0].database);
      console.log("Database user:", db.rows[0].username);

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

      if (files.length === 0) {
        console.log("No SQL migration files found.");
        return;
      }

      for (const filename of files) {
        const alreadyApplied = await client.query(
          "SELECT 1 FROM schema_migrations WHERE filename = $1",
          [filename]
        );

        if (alreadyApplied.rowCount) {
          console.log(`Skipping ${filename} (already applied).`);
          continue;
        }

        // The authentication schema was previously applied by
        // SimLab's auth service, which did not track migration history.
        // Baseline it only when all four auth tables already exist.
        if (filename === "001_auth_schema.sql") {
          const existing = await client.query(`
            SELECT
              to_regclass('public.users') IS NOT NULL AS users,
              to_regclass('public.sessions') IS NOT NULL AS sessions,
              to_regclass('public.auth_events') IS NOT NULL AS auth_events,
              to_regclass('public.password_resets') IS NOT NULL
                AS password_resets
          `);

          const authSchemaExists = Object.values(existing.rows[0])
            .every(Boolean);

          if (authSchemaExists) {
            await client.query(
              "INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING",
              [filename]
            );

            console.log(`Recorded existing schema: ${filename}`);
            continue;
          }
        }

        const sql = fs.readFileSync(
          path.join(migrationsDir, filename),
          "utf8"
        );

        console.log(`Applying ${filename}...`);

        await client.query("BEGIN");

        try {
          await client.query(sql);

          await client.query(
            "INSERT INTO schema_migrations (filename) VALUES ($1)",
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

main().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exitCode = 1;
});
