import "dotenv/config";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { migrate } from "drizzle-orm/sqlite-proxy/migrator";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");

const dbPath = databaseUrl.startsWith("file:") ? databaseUrl.slice(5) : databaseUrl;

const sqlite = new DatabaseSync(dbPath);

const db = drizzle(async (sql, params, method) => {
  const stmt = sqlite.prepare(sql);
  stmt.setReturnArrays(true);
  if (method === "run") {
    stmt.run(...(params as []));
    return { rows: [] };
  }
  return { rows: stmt.all(...(params as [])) as unknown[][] };
});

async function runMigrations() {
  console.log("Running migrations...");
  await migrate(
    db,
    async (queries) => {
      for (const query of queries) {
        sqlite.exec(query);
      }
    },
    { migrationsFolder: "./drizzle" },
  );
  console.log("Migrations completed successfully!");
  process.exit(0);
}

runMigrations().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
