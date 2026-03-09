import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { migrate } from "drizzle-orm/sqlite-proxy/migrator";
import { join } from "node:path";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

// Convert "file:/path" URL to a plain path for node:sqlite
const dbPath = databaseUrl.startsWith("file:") ? databaseUrl.slice(5) : databaseUrl;

const sqlite = new DatabaseSync(dbPath);

export const db = drizzle(
  async (sql, params, method) => {
    const stmt = sqlite.prepare(sql);
    // setReturnArrays(true) returns rows as value arrays instead of named objects.
    // This is required because JOIN queries can select same-named columns from
    // multiple tables (e.g. both invite_codes.status and sessions.status).
    // A plain object would silently overwrite the duplicate key, causing wrong
    // values at the wrong positional index when drizzle maps fields by position.
    stmt.setReturnArrays(true);
    if (method === "run") {
      stmt.run(...(params as []));
      return { rows: [] };
    }
    if (method === "get") {
      const row = stmt.get(...(params as [])) as unknown[] | undefined;
      // Return undefined (not []) when no row found so drizzle mapGetResult
      // returns undefined rather than a partially-filled object.
      return { rows: (row ?? undefined) as unknown as [] };
    }
    // "all" and "values" — already arrays of arrays with setReturnArrays
    return { rows: stmt.all(...(params as [])) as unknown[][] };
  },
  { schema },
);

// Automatically apply any pending migrations at startup so the schema is always
// up-to-date before the server handles its first request.  The migrator is
// idempotent — it tracks applied migrations and skips them on subsequent runs.
await migrate(
  db,
  async (queries) => {
    for (const query of queries) {
      sqlite.exec(query);
    }
  },
  { migrationsFolder: join(process.cwd(), "drizzle") },
);

// Load persisted settings into process.env (app_settings is guaranteed to exist
// now that migrations have run above).
const settingsRows = sqlite
  .prepare("SELECT key, value FROM app_settings WHERE value IS NOT NULL")
  .all() as { key: string; value: string }[];
for (const row of settingsRows) {
  process.env[row.key] = row.value;
}
