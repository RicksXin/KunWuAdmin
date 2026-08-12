import "dotenv/config";

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../db/schema";

export function databaseUrl(kind: "runtime" | "migration" = "runtime") {
  const value = kind === "migration"
    ? process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL
    : process.env.DATABASE_URL;
  if (!value?.startsWith("mysql://")) {
    throw new Error(`${kind === "migration" ? "DATABASE_MIGRATION_URL or DATABASE_URL" : "DATABASE_URL"} must be set`);
  }
  return value;
}

export function createToolDatabase(kind: "runtime" | "migration" = "runtime") {
  const pool = mysql.createPool({
    uri: databaseUrl(kind),
    connectionLimit: 4,
    timezone: "Z",
    charset: "utf8mb4",
  });
  return { pool, db: drizzle(pool, { schema, mode: "default" }) };
}
