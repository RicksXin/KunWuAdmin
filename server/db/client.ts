import "server-only";

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "@/db/schema";
import { getDatabaseEnv } from "./env";

type DatabasePool = ReturnType<typeof mysql.createPool>;

const globalDatabase = globalThis as typeof globalThis & {
  kunwuDatabasePool?: DatabasePool;
};

function createDatabasePool() {
  const { DATABASE_URL } = getDatabaseEnv();
  return mysql.createPool({
    uri: DATABASE_URL,
    connectionLimit: 10,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    timezone: "Z",
    charset: "utf8mb4",
    dateStrings: false,
  });
}

export const databasePool = globalDatabase.kunwuDatabasePool ?? createDatabasePool();

if (process.env.NODE_ENV !== "production") {
  globalDatabase.kunwuDatabasePool = databasePool;
}

export const database = drizzle(databasePool, { schema, mode: "default" });

export async function checkDatabaseConnection() {
  const [rows] = await databasePool.query<mysql.RowDataPacket[]>(
    "SELECT VERSION() AS version, @@session.time_zone AS timeZone, DATABASE() AS databaseName",
  );
  const row = rows[0];
  return {
    version: String(row?.version ?? "unknown"),
    timeZone: String(row?.timeZone ?? "unknown"),
    databaseName: String(row?.databaseName ?? "unknown"),
  };
}
