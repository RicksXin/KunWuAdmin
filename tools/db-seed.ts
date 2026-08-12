import { eq } from "drizzle-orm";
import { v5 as uuidv5 } from "uuid";
import {
  adminPermissions,
  adminRolePermissions,
  adminRoles,
  configChannelHeads,
  configPublishLocks,
  configSets,
} from "../db/schema";
import { createToolDatabase } from "./db-runtime";

const SEED_NAMESPACE = "4fbe5608-d921-4f17-b5be-42aebf95ee0c";
const stableId = (name: string) => uuidv5(name, SEED_NAMESPACE);

const permissions = [
  ["config.read", "查看配置"],
  ["config.write", "编辑配置"],
  ["config.import", "导入配置"],
  ["validation.run", "执行校验"],
  ["release.build", "构建开发版本"],
  ["release.review", "审核配置变更"],
  ["release.production", "晋级生产版本"],
  ["release.rollback", "回滚发布版本"],
  ["system.manage", "管理系统设置"],
] as const;

const roles = [
  ["system_admin", "系统管理员", permissions.map(([code]) => code)],
  ["config_designer", "配置策划", ["config.read", "config.write", "config.import", "validation.run", "release.build"]],
  ["story_designer", "剧情策划", ["config.read", "config.write", "validation.run", "release.build"]],
  ["release_reviewer", "审核发布人", ["config.read", "validation.run", "release.review", "release.build", "release.production", "release.rollback"]],
  ["viewer", "只读成员", ["config.read"]],
] as const;

const configSetRows = [
  { id: stableId("config-set:demo_d0"), code: "demo_d0", name: "D0 Demo", notes: "当前 Godot 可玩闭环与验收数值" },
  { id: stableId("config-set:v1_0"), code: "v1_0", name: "1.0 正式版", notes: "1.0 策划与 PRD 派生配置" },
];

const channels = ["development", "staging", "production"] as const;
async function main() {
  const { pool, db } = createToolDatabase("runtime");
  try {
    await db.transaction(async (tx) => {
    for (const [code, name] of permissions) {
      await tx.insert(adminPermissions).values({ id: stableId(`permission:${code}`), code, name })
        .onDuplicateKeyUpdate({ set: { name } });
    }

    for (const [code, name] of roles) {
      await tx.insert(adminRoles).values({ id: stableId(`role:${code}`), code, name })
        .onDuplicateKeyUpdate({ set: { name } });
    }

    for (const [roleCode, , grantedPermissions] of roles) {
      const roleId = stableId(`role:${roleCode}`);
      for (const permissionCode of grantedPermissions) {
        await tx.insert(adminRolePermissions).values({
          id: stableId(`role-permission:${roleCode}:${permissionCode}`),
          roleId,
          permissionId: stableId(`permission:${permissionCode}`),
        }).onDuplicateKeyUpdate({ set: { roleId } });
      }
    }

    for (const configSet of configSetRows) {
      await tx.insert(configSets).values(configSet).onDuplicateKeyUpdate({
        set: { name: configSet.name, notes: configSet.notes, status: "active" },
      });
      await tx.insert(configPublishLocks).values({ lockKey: `config-set:${configSet.id}:build` })
        .onDuplicateKeyUpdate({ set: { lockKey: `config-set:${configSet.id}:build` } });
    }

    for (const channel of channels) {
      await tx.insert(configChannelHeads).values({ channel }).onDuplicateKeyUpdate({ set: { channel } });
      await tx.insert(configPublishLocks).values({ lockKey: `channel:${channel}:publish` })
        .onDuplicateKeyUpdate({ set: { lockKey: `channel:${channel}:publish` } });
    }
    });

    const seededSets = await db.select({ code: configSets.code, name: configSets.name })
      .from(configSets).where(eq(configSets.status, "active"));
    console.log("DATABASE_SEED_OK", seededSets);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
