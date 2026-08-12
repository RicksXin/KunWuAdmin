import { customType, datetime, int, text, varchar } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { parse as parseUuid, stringify as stringifyUuid, v7 as uuidv7 } from "uuid";

export const uuidBinary = customType<{ data: string; driverData: Buffer }>({
  dataType: () => "binary(16)",
  toDriver: (value) => Buffer.from(parseUuid(value)),
  fromDriver: (value) => stringifyUuid(value),
});

export const hashBinary = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "binary(32)",
  toDriver: (value) => value,
  fromDriver: (value) => value,
});

export const longBlob = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "longblob",
  toDriver: (value) => value,
  fromDriver: (value) => value,
});

export const idColumn = () => uuidBinary("id").primaryKey().$defaultFn(uuidv7);
export const utcDateTime = (name: string) => datetime(name, { fsp: 3, mode: "date" });
export const createdAtColumn = () => utcDateTime("created_at").notNull().default(sql`CURRENT_TIMESTAMP(3)`);
export const updatedAtColumn = () => utcDateTime("updated_at").notNull().default(sql`CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`);
export const statusColumn = (defaultValue = "active") => varchar("status", { length: 24 }).notNull().default(defaultValue);
export const revisionColumn = () => int("revision", { unsigned: true }).notNull().default(1);
export const notesColumn = () => text("notes");
