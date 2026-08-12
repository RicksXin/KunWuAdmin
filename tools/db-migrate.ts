import { migrate } from "drizzle-orm/mysql2/migrator";
import { createToolDatabase } from "./db-runtime";

async function main() {
  const { pool, db } = createToolDatabase("migration");
  try {
    await migrate(db, { migrationsFolder: "db/migrations" });
    console.log("DATABASE_MIGRATION_OK");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
