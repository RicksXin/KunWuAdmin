import { int, varchar } from "drizzle-orm/mysql-core";
import { configSets } from "./config";
import {
  createdAtColumn,
  idColumn,
  notesColumn,
  revisionColumn,
  statusColumn,
  updatedAtColumn,
  uuidBinary,
} from "./columns";

export function editableConfigColumns() {
  return {
    id: idColumn(),
    configSetId: uuidBinary("config_set_id").notNull().references(() => configSets.id),
    code: varchar("code", { length: 96 }).notNull(),
    status: statusColumn(),
    sortOrder: int("sort_order").notNull().default(0),
    revision: revisionColumn(),
    notes: notesColumn(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  };
}
