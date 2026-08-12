import type { RowDataPacket } from "mysql2";
import { createToolDatabase } from "./db-runtime";

async function main() {
  const { pool } = createToolDatabase("runtime");
  try {
    const [serverRows] = await pool.query<RowDataPacket[]>(
    "SELECT VERSION() version, @@session.time_zone time_zone, @@character_set_database charset, @@collation_database collation",
  );
    const [tableRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) table_count FROM information_schema.tables WHERE table_schema = DATABASE()",
  );
    const [setRows] = await pool.query<RowDataPacket[]>(
    "SELECT code, name, current_revision FROM config_set ORDER BY code",
  );
    const [channelRows] = await pool.query<RowDataPacket[]>(
    "SELECT channel, active_release_id IS NOT NULL has_release FROM config_channel_head ORDER BY channel",
  );
    const [businessRows] = await pool.query<RowDataPacket[]>(
      `SELECT
        (SELECT COUNT(*) FROM game_asset) assets,
        (SELECT COUNT(*) FROM career) careers,
        (SELECT COUNT(*) FROM skill) skills,
        (SELECT COUNT(*) FROM map_definition) maps,
        (SELECT COUNT(*) FROM config_import_issue) import_issues`,
    );
    const [referenceRows] = await pool.query<RowDataPacket[]>(
      `SELECT
        (SELECT COUNT(*) FROM career_skill cs LEFT JOIN skill s ON s.id = cs.skill_id WHERE s.id IS NULL) missing_career_skills,
        (SELECT COUNT(*) FROM enemy_skill es LEFT JOIN skill s ON s.id = es.skill_id WHERE s.id IS NULL) missing_enemy_skills,
        (SELECT COUNT(*) FROM encounter_member em LEFT JOIN enemy e ON e.id = em.enemy_id WHERE e.id IS NULL) missing_encounter_enemies,
        (SELECT COUNT(*) FROM map_object_placement p LEFT JOIN map_object_prototype mp ON mp.id = p.prototype_id WHERE mp.id IS NULL) missing_map_objects`,
    );

    const tableCount = Number(tableRows[0]?.table_count ?? 0);
    if (tableCount < 58) throw new Error(`Expected at least 58 tables, found ${tableCount}`);
    if (setRows.length !== 2) throw new Error(`Expected 2 config sets, found ${setRows.length}`);
    if (channelRows.length !== 3) throw new Error(`Expected 3 channels, found ${channelRows.length}`);
    const business = businessRows[0];
    if (Number(business?.assets ?? 0) < 12) throw new Error("D0 assets have not been imported");
    if (Number(business?.careers ?? 0) < 6) throw new Error("D0 careers have not been imported");
    if (Number(business?.skills ?? 0) < 21) throw new Error("D0 skills have not been imported");
    const missingReferences = Object.values(referenceRows[0] ?? {}).reduce((sum, current) => sum + Number(current), 0);
    if (missingReferences !== 0) throw new Error(`Found ${missingReferences} broken business references`);

    console.log("DATABASE_CHECK_OK", {
      server: serverRows[0],
      tableCount,
      configSets: setRows,
      channels: channelRows,
      business,
      references: referenceRows[0],
    });
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
