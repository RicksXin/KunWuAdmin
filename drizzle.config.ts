import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_MIGRATION_URL or DATABASE_URL is required");
}

export default defineConfig({
  dialect: "mysql",
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
  dbCredentials: { url: databaseUrl },
  strict: true,
  verbose: true,
});
