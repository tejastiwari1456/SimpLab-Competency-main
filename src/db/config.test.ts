import test from "node:test";
import assert from "node:assert/strict";
import {
  getDatabaseConfigSummary,
  resolvePostgresPoolConfig,
} from "./config";

test("uses SQL_* environment variables in standard Cloud SQL runtime", () => {
  const cfg = resolvePostgresPoolConfig({
    SQL_HOST: "/cloudsql/proj:region:inst",
    SQL_USER: "app_user",
    SQL_PASSWORD: "secret",
    SQL_DB_NAME: "simlab",
  });

  assert.equal(cfg.host, "/cloudsql/proj:region:inst");
  assert.equal(cfg.user, "app_user");
  assert.equal(cfg.database, "simlab");
  assert.equal(cfg.max, 10);
  assert.equal(cfg.ssl, undefined);
  assert.equal(cfg.allowExitOnIdle, undefined);
});

test("uses DATABASE_URL with serverless pool tuning and SSL on Vercel", () => {
  const cfg = resolvePostgresPoolConfig({
    VERCEL: "1",
    DATABASE_URL: "postgresql://user:pass@ep-cool-db.aws.neon.tech/simlab?sslmode=require",
  });

  assert.equal(
    cfg.connectionString,
    "postgresql://user:pass@ep-cool-db.aws.neon.tech/simlab?sslmode=require"
  );
  assert.equal(cfg.max, 3);
  assert.equal(cfg.allowExitOnIdle, true);
  assert.deepEqual(cfg.ssl, { rejectUnauthorized: false });
});

test("respects explicit DATABASE_SSL=false override even on Vercel", () => {
  const cfg = resolvePostgresPoolConfig({
    VERCEL: "1",
    DATABASE_URL: "postgresql://user:pass@db.example.com/simlab",
    DATABASE_SSL: "false",
  });

  assert.equal(cfg.ssl, false);
});

test("prefers admin credentials when preferAdmin is enabled for migrations", () => {
  const cfg = resolvePostgresPoolConfig(
    {
      SQL_HOST: "10.0.0.1",
      SQL_PORT: "5432",
      SQL_USER: "app_user",
      SQL_PASSWORD: "app_password",
      SQL_ADMIN_USER: "postgres",
      SQL_ADMIN_PASSWORD: "admin_password",
      SQL_DB_NAME: "simlab",
      SQL_SSL: "true",
    },
    { preferAdmin: true }
  );

  assert.equal(cfg.user, "postgres");
  assert.equal(cfg.password, "admin_password");
  assert.equal(cfg.port, 5432);
  assert.deepEqual(cfg.ssl, { rejectUnauthorized: false });
});

test("reports safe non-secret database configuration summary", () => {
  assert.deepEqual(getDatabaseConfigSummary({}), {
    configured: false,
    mode: "unconfigured",
    sslEnabled: false,
    serverless: false,
  });

  assert.deepEqual(
    getDatabaseConfigSummary({
      VERCEL: "1",
      POSTGRES_URL: "postgres://u:p@db.neon.tech/simlab",
    }),
    {
      configured: true,
      mode: "connection_url",
      sslEnabled: true,
      serverless: true,
    }
  );
});
