import type { PoolConfig } from "pg";

export interface ResolveDbOptions {
  preferAdmin?: boolean;
  maxOverride?: number;
}

export interface DatabaseConfigSummary {
  configured: boolean;
  mode: "connection_url" | "sql_env" | "unconfigured";
  sslEnabled: boolean;
  serverless: boolean;
}

function isLocalOrSocketHost(host: string | undefined): boolean {
  if (!host) return true;
  const h = host.trim().toLowerCase();
  return (
    h.startsWith("/") ||
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h === "0.0.0.0"
  );
}

function extractHostFromUrl(connectionString: string): string | undefined {
  try {
    const parsed = new URL(connectionString);
    return parsed.hostname || undefined;
  } catch {
    return undefined;
  }
}

function extractSslModeFromUrl(connectionString: string): string | undefined {
  try {
    const parsed = new URL(connectionString);
    return parsed.searchParams.get("sslmode")?.toLowerCase() || undefined;
  } catch {
    return undefined;
  }
}

export function isServerlessRuntime(
  env: Record<string, string | undefined> = process.env
): boolean {
  return (
    env.VERCEL === "1" ||
    env.VERCEL === "true" ||
    env.SERVERLESS === "true" ||
    Boolean(env.AWS_LAMBDA_FUNCTION_NAME)
  );
}

export function resolveSslOption(
  env: Record<string, string | undefined>,
  targetHost: string | undefined,
  urlSslMode?: string
): PoolConfig["ssl"] {
  const explicitFlag = (env.DATABASE_SSL ?? env.SQL_SSL ?? "").trim().toLowerCase();
  const pgSslMode = (urlSslMode || env.PGSSLMODE || "").trim().toLowerCase();
  const rejectUnauthorized =
    (env.DATABASE_SSL_REJECT_UNAUTHORIZED || "").trim().toLowerCase() === "true";

  if (
    explicitFlag === "false" ||
    explicitFlag === "0" ||
    explicitFlag === "disable" ||
    pgSslMode === "disable"
  ) {
    return false;
  }

  if (
    explicitFlag === "true" ||
    explicitFlag === "1" ||
    explicitFlag === "require" ||
    pgSslMode === "require" ||
    pgSslMode === "verify-ca" ||
    pgSslMode === "verify-full" ||
    pgSslMode === "prefer" ||
    pgSslMode === "no-verify"
  ) {
    return { rejectUnauthorized };
  }

  // On Vercel/serverless connecting to a remote managed Postgres (Neon, Supabase,
  // Vercel Postgres, Cloud SQL Public IP), SSL is required by default.
  if (isServerlessRuntime(env) && !isLocalOrSocketHost(targetHost)) {
    return { rejectUnauthorized };
  }

  return undefined;
}

export function getConnectionString(
  env: Record<string, string | undefined> = process.env
): string | undefined {
  const candidates = [
    env.DATABASE_URL,
    env.POSTGRES_URL,
    env.POSTGRES_PRISMA_URL,
    env.POSTGRES_URL_NON_POOLING,
  ];
  for (const candidate of candidates) {
    if (candidate && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return undefined;
}

/**
 * Resolves a node-postgres PoolConfig compatible with:
 * 1) Vercel / Neon / Supabase / Vercel Postgres / Cloud SQL via DATABASE_URL or POSTGRES_URL
 * 2) AI Studio Cloud SQL runtime via SQL_HOST / SQL_USER / SQL_PASSWORD / SQL_DB_NAME
 */
export function resolvePostgresPoolConfig(
  env: Record<string, string | undefined> = process.env,
  options: ResolveDbOptions = {}
): PoolConfig {
  const serverless = isServerlessRuntime(env);
  const parsedMax = Number(env.PG_POOL_MAX);
  const max =
    options.maxOverride ??
    (Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : serverless ? 3 : 10);

  const parsedTimeout = Number(env.PG_CONNECTION_TIMEOUT_MS);
  const connectionTimeoutMillis =
    Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 15000;

  const baseConfig: PoolConfig = {
    max,
    connectionTimeoutMillis,
    idleTimeoutMillis: serverless ? 10000 : 30000,
    ...(serverless ? { allowExitOnIdle: true } : {}),
  };

  const connectionString = getConnectionString(env);
  if (connectionString) {
    const host = extractHostFromUrl(connectionString);
    const sslMode = extractSslModeFromUrl(connectionString);
    const ssl = resolveSslOption(env, host, sslMode);
    return {
      ...baseConfig,
      connectionString,
      ...(ssl !== undefined ? { ssl } : {}),
    };
  }

  const host = env.SQL_HOST?.trim();
  const parsedPort = env.SQL_PORT ? Number(env.SQL_PORT) : undefined;
  const port = parsedPort && Number.isFinite(parsedPort) ? parsedPort : undefined;
  const user = options.preferAdmin
    ? env.SQL_ADMIN_USER?.trim() || env.SQL_USER?.trim()
    : env.SQL_USER?.trim();
  const password = options.preferAdmin
    ? env.SQL_ADMIN_PASSWORD || env.SQL_PASSWORD
    : env.SQL_PASSWORD;
  const database = env.SQL_DB_NAME?.trim();
  const ssl = resolveSslOption(env, host);

  return {
    ...baseConfig,
    host,
    ...(port ? { port } : {}),
    user,
    password,
    database,
    ...(ssl !== undefined ? { ssl } : {}),
  };
}

export function getDatabaseConfigSummary(
  env: Record<string, string | undefined> = process.env
): DatabaseConfigSummary {
  const serverless = isServerlessRuntime(env);
  const connectionString = getConnectionString(env);
  if (connectionString) {
    const ssl = resolveSslOption(
      env,
      extractHostFromUrl(connectionString),
      extractSslModeFromUrl(connectionString)
    );
    return {
      configured: true,
      mode: "connection_url",
      sslEnabled: Boolean(ssl),
      serverless,
    };
  }

  if (env.SQL_HOST && env.SQL_DB_NAME && env.SQL_USER) {
    const ssl = resolveSslOption(env, env.SQL_HOST);
    return {
      configured: true,
      mode: "sql_env",
      sslEnabled: Boolean(ssl),
      serverless,
    };
  }

  return {
    configured: false,
    mode: "unconfigured",
    sslEnabled: false,
    serverless,
  };
}
