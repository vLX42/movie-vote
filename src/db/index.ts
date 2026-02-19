import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
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
    if (method === "run") {
      stmt.run(...(params as []));
      return { rows: [] };
    }
    if (method === "get") {
      const row = stmt.get(...(params as [])) as Record<string, unknown> | undefined;
      // Must return undefined (not []) when no row found.
      // drizzle mapGetResult does `if (!row) return void 0` — an empty array []
      // is truthy and would make drizzle return {id: undefined} instead of undefined.
      return { rows: (row ? Object.values(row) : undefined) as unknown as [] };
    }
    // "all" and "values"
    const rows = (stmt.all(...(params as [])) as Record<string, unknown>[]).map(
      (r) => Object.values(r),
    );
    return { rows };
  },
  { schema },
);
