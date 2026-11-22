import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, PoolClient } from "pg";
import * as schema from "./schema";
import {
  getDatabaseConfigSummary,
  resolvePostgresPoolConfig,
} from "./config";

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = (): Pool => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool(resolvePostgresPoolConfig(process.env));

    global._postgresPool.on("error", (err) => {
      console.error("[PostgreSQL] Unexpected error on idle pool client:", err);
    });
  }
  return global._postgresPool;
};

export const pool = createPool();
export const db = drizzle(pool, { schema });

export { getDatabaseConfigSummary };

export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  latencyMs?: number;
}> {
  const startedAt = Date.now();
  try {
    await pool.query("SELECT 1");
    return {
      connected: true,
      latencyMs: Date.now() - startedAt,
    };
  } catch (err) {
    console.error("[PostgreSQL] Health check failed:", err);
    return { connected: false };
  }
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
