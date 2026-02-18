import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const client = createClient({ url: databaseUrl });
const db = drizzle({ client });

async function runMigrations() {
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations completed successfully!");
  process.exit(0);
}

runMigrations().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
