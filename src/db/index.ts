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
