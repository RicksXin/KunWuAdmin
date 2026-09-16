import { createHash } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { rulesSchema } from "../domain/resources/rules";

export async function publishedRecruitment(pool: Pool, channel: "development" | "staging" | "production") {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id,rules,hash,effective_at FROM resource_rule_release WHERE environment=? AND effective_at<=FLOOR(UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3))*1000) ORDER BY effective_at DESC LIMIT 1", [channel]);
  if (!rows.length) return null;
  const row = rows[0];
  const raw: unknown = typeof row.rules === "string" ? JSON.parse(row.rules) : row.rules;
  const canonical = JSON.stringify(raw, (_key, value) => value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
  if (createHash("sha256").update(canonical).digest("hex") !== row.hash) throw new Error("Published recruitment hash mismatch");
  const rules = rulesSchema.parse(raw);
  return {schemaVersion: 1, releaseId: String(row.id), effectiveAtMs: Number(row.effective_at),
    initialWorkers: rules.initialWorkers, maxWorkers: rules.maxWorkers, workersPerRecruit: 1, recruitCosts: rules.recruitCosts};
}
