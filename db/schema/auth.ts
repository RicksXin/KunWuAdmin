import { index, mysqlTable, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { createdAtColumn, idColumn, statusColumn, updatedAtColumn, utcDateTime, uuidBinary } from "./columns";

export const adminUsers = mysqlTable("admin_user", {
  id: idColumn(),
  email: varchar("email", { length: 254 }).notNull(),
  displayName: varchar("display_name", { length: 96 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }),
  status: statusColumn(),
  lastLoginAt: utcDateTime("last_login_at"),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
}, (table) => [
  uniqueIndex("uq_admin_user_email").on(table.email),
  index("idx_admin_user_status").on(table.status),
]);

export const adminRoles = mysqlTable("admin_role", {
  id: idColumn(),
  code: varchar("code", { length: 64 }).notNull(),
  name: varchar("name", { length: 96 }).notNull(),
  createdAt: createdAtColumn(),
}, (table) => [uniqueIndex("uq_admin_role_code").on(table.code)]);

export const adminPermissions = mysqlTable("admin_permission", {
  id: idColumn(),
  code: varchar("code", { length: 96 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  createdAt: createdAtColumn(),
}, (table) => [uniqueIndex("uq_admin_permission_code").on(table.code)]);

export const adminUserRoles = mysqlTable("admin_user_role", {
  id: idColumn(),
  userId: uuidBinary("user_id").notNull().references(() => adminUsers.id, { onDelete: "cascade" }),
  roleId: uuidBinary("role_id").notNull().references(() => adminRoles.id, { onDelete: "cascade" }),
  createdAt: createdAtColumn(),
}, (table) => [
  uniqueIndex("uq_admin_user_role").on(table.userId, table.roleId),
  index("idx_admin_user_role_role").on(table.roleId),
]);

export const adminRolePermissions = mysqlTable("admin_role_permission", {
  id: idColumn(),
  roleId: uuidBinary("role_id").notNull().references(() => adminRoles.id, { onDelete: "cascade" }),
  permissionId: uuidBinary("permission_id").notNull().references(() => adminPermissions.id, { onDelete: "cascade" }),
  createdAt: createdAtColumn(),
}, (table) => [
  uniqueIndex("uq_admin_role_permission").on(table.roleId, table.permissionId),
  index("idx_admin_role_permission_permission").on(table.permissionId),
]);

export const adminSessions = mysqlTable("admin_session", {
  id: idColumn(),
  sessionToken: varchar("session_token", { length: 255 }).notNull(),
  userId: uuidBinary("user_id").notNull().references(() => adminUsers.id, { onDelete: "cascade" }),
  expiresAt: utcDateTime("expires_at").notNull(),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
}, (table) => [
  uniqueIndex("uq_admin_session_token").on(table.sessionToken),
  index("idx_admin_session_user").on(table.userId),
  index("idx_admin_session_expires").on(table.expiresAt),
]);
