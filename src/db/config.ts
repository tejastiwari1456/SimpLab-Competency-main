import type { PoolConfig } from "pg";

export interface ResolveDbOptions {
  preferAdmin?: boolean;
  maxOverride?: number;
}

export interface DatabaseConfigSummary {
  configured: boolean;
  mode: "connection_url" | "sql_env" | "unconfigured";
  provider: "supabase" | "cloudsql" | "postgres" | "unconfigured";
  sslEnabled: boolean;
  serverless: boolean;
}

const MANAGED_SSL_HOST_SUFFIXES = [
  ".supabase.com",
  ".supabase.co",
  ".neon.tech",
  ".render.com",
  ".railway.app",
  ".cockroachlabs.cloud",
  ".aivencloud.com",
];

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

function isManagedCloudPostgresHost(host: string | undefined): boolean {
  if (!host) return false;
  const h = host.trim().toLowerCase();
  return MANAGED_SSL_HOST_SUFFIXES.some((suffix) => h.endsWith(suffix));
}

function isSupabaseHost(host: string | undefined): boolean {
  if (!host) return false;
  const h = host.trim().toLowerCase();
  return h.endsWith(".supabase.com") || h.endsWith(".supabase.co");
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export interface ParsedPostgresConnection {
  host: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  sslMode?: string;
  needsStructuredFields: boolean;
}

/**
 * Parses PostgreSQL connection URLs safely, including passwords containing
 * unescaped URL characters (?, &, %, #) or accidental whitespace/newlines.
 */
export function parsePostgresUrl(rawUrl: string): ParsedPostgresConnection | null {
  const cleaned = rawUrl.replace(/[\r\n\t]+/g, "").trim();
  const schemeMatch = cleaned.match(/^postgres(?:ql)?:\/\/(.+)$/i);
  if (!schemeMatch) return null;

  // Try standard WHATWG URL parsing first
  try {
    const parsed = new URL(cleaned);
    // Guard against passwords containing '?' or '#' splitting the authority before '@'
    const hasAtInSearchOrHash =
      parsed.search.includes("@") || parsed.hash.includes("@");
    if (parsed.hostname && !hasAtInSearchOrHash) {
      const portNum = parsed.port ? Number(parsed.port) : undefined;
      return {
        host: parsed.hostname,
        port: portNum && Number.isFinite(portNum) ? portNum : undefined,
        user: parsed.username ? safeDecodeURIComponent(parsed.username) : undefined,
        password: parsed.password ? safeDecodeURIComponent(parsed.password) : undefined,
        database: parsed.pathname.replace(/^\//, "") || undefined,
        sslMode: parsed.searchParams.get("sslmode")?.toLowerCase() || undefined,
        needsStructuredFields: false,
      };
    }
  } catch {
    // Fall through to resilient authority parser below
  }

  // Resilient fallback: split on the LAST '@' in authority before path/host
  const rest = schemeMatch[1];
  const lastAt = rest.lastIndexOf("@");
  if (lastAt === -1) return null;

  const userInfo = rest.slice(0, lastAt);
  const hostAndPath = rest.slice(lastAt + 1);

  let hostParsed: URL;
  try {
    hostParsed = new URL(`postgresql://${hostAndPath}`);
  } catch {
    return null;
  }

  const firstColon = userInfo.indexOf(":");
  const rawUser = firstColon === -1 ? userInfo : userInfo.slice(0, firstColon);
  const rawPassword = firstColon === -1 ? undefined : userInfo.slice(firstColon + 1);
  const portNum = hostParsed.port ? Number(hostParsed.port) : undefined;

  return {
    host: hostParsed.hostname,
    port: portNum && Number.isFinite(portNum) ? portNum : undefined,
    user: rawUser ? safeDecodeURIComponent(rawUser) : undefined,
    password: rawPassword !== undefined ? safeDecodeURIComponent(rawPassword) : undefined,
    database: hostParsed.pathname.replace(/^\//, "") || undefined,
    sslMode: hostParsed.searchParams.get("sslmode")?.toLowerCase() || undefined,
    needsStructuredFields: true,
  };
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

  // Managed cloud PostgreSQL providers (Supabase, Neon, etc.) require SSL in all runtimes
  if (isManagedCloudPostgresHost(targetHost)) {
    return { rejectUnauthorized };
  }

  // On Vercel/serverless connecting to any remote host, default to SSL
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
    env.SUPABASE_DATABASE_URL,
    env.POSTGRES_URL,
    env.POSTGRES_PRISMA_URL,
    env.POSTGRES_URL_NON_POOLING,
  ];
  for (const candidate of candidates) {
    if (candidate && candidate.trim().length > 0) {
      return candidate.replace(/[\r\n\t]+/g, "").trim();
    }
  }
  return undefined;
}

/**
 * Resolves a node-postgres PoolConfig compatible with:
 * 1) Supabase (Session or Supavisor Transaction Pooler port 6543) & Vercel/Neon via DATABASE_URL
 * 2) AI Studio Cloud SQL runtime via SQL_HOST / SQL_USER / SQL_PASSWORD / SQL_DB_NAME
 */
export function resolvePostgresPoolConfig(
  env: Record<string, string | undefined> = process.env,
  options: ResolveDbOptions = {}
): PoolConfig {
  const serverless = isServerlessRuntime(env);
  const connectionString = getConnectionString(env);
  const parsed = connectionString ? parsePostgresUrl(connectionString) : null;
  const targetHost = parsed?.host || env.SQL_HOST?.trim();
  const isSupabasePooler = isSupabaseHost(targetHost) && parsed?.port === 6543;

  const parsedMax = Number(env.PG_POOL_MAX);
  const defaultMax = serverless ? 3 : isSupabasePooler ? 5 : 10;
  const max =
    options.maxOverride ??
    (Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : defaultMax);

  const parsedTimeout = Number(env.PG_CONNECTION_TIMEOUT_MS);
  const connectionTimeoutMillis =
    Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 15000;

  const baseConfig: PoolConfig = {
    max,
    connectionTimeoutMillis,
    idleTimeoutMillis: serverless || isSupabasePooler ? 10000 : 30000,
    ...(serverless ? { allowExitOnIdle: true } : {}),
  };

  if (connectionString) {
    const ssl = resolveSslOption(env, parsed?.host, parsed?.sslMode);

    if (parsed && parsed.needsStructuredFields) {
      return {
        ...baseConfig,
        host: parsed.host,
        ...(parsed.port ? { port: parsed.port } : {}),
        ...(parsed.user ? { user: parsed.user } : {}),
        ...(parsed.password !== undefined ? { password: parsed.password } : {}),
        ...(parsed.database ? { database: parsed.database } : {}),
        ...(ssl !== undefined ? { ssl } : {}),
      };
    }

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
    const parsed = parsePostgresUrl(connectionString);
    const ssl = resolveSslOption(env, parsed?.host, parsed?.sslMode);
    return {
      configured: true,
      mode: "connection_url",
      provider: isSupabaseHost(parsed?.host) ? "supabase" : "postgres",
      sslEnabled: Boolean(ssl),
      serverless,
    };
  }

  if (env.SQL_HOST && env.SQL_DB_NAME && env.SQL_USER) {
    const ssl = resolveSslOption(env, env.SQL_HOST);
    const provider = env.SQL_HOST.startsWith("/cloudsql/")
      ? "cloudsql"
      : isSupabaseHost(env.SQL_HOST)
      ? "supabase"
      : "postgres";
    return {
      configured: true,
      mode: "sql_env",
      provider,
      sslEnabled: Boolean(ssl),
      serverless,
    };
  }

  return {
    configured: false,
    mode: "unconfigured",
    provider: "unconfigured",
    sslEnabled: false,
    serverless,
  };
}
