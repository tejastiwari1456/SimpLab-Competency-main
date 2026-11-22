import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
import { getConnectionString, resolveSslOption } from "./config";

dotenv.config();

const connectionString = getConnectionString(process.env);

let dbCredentials:
  | { url: string }
  | {
      host: string;
      port?: number;
      user: string;
      password: string;
      database: string;
      ssl: boolean | { rejectUnauthorized: boolean };
    };

if (connectionString) {
  dbCredentials = { url: connectionString };
} else {
  const sqlHost = process.env.SQL_HOST;
  const sqlDbName = process.env.SQL_DB_NAME;
  const user = process.env.SQL_ADMIN_USER || process.env.SQL_USER;
  const password = process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD;

  if (!sqlHost) {
    throw new Error("DATABASE_URL or SQL_HOST must be set in environment variables.");
  }
  if (!sqlDbName) {
    throw new Error("DATABASE_URL or SQL_DB_NAME must be set in environment variables.");
  }
  if (!user) {
    throw new Error("DATABASE_URL or SQL_ADMIN_USER/SQL_USER must be set in environment variables.");
  }
  if (!password) {
    throw new Error("DATABASE_URL or SQL_ADMIN_PASSWORD/SQL_PASSWORD must be set in environment variables.");
  }

  const sslOpt = resolveSslOption(process.env, sqlHost);
  const parsedPort = process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined;

  dbCredentials = {
    host: sqlHost,
    ...(parsedPort && Number.isFinite(parsedPort) ? { port: parsedPort } : {}),
    user,
    password,
    database: sqlDbName,
    ssl: sslOpt ? { rejectUnauthorized: false } : false,
  };
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials,
  verbose: true,
});
