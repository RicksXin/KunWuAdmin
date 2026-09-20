import "server-only";
import { createHash } from "node:crypto";
import { and,desc,eq } from "drizzle-orm";
import { z } from "zod";
import { database } from "@/server/db/client";
import { gameParameters,resourceRuleDrafts,resourceRuleReleases } from "@/db/schema";
import { currentRulesSchema } from "@/server/domain/resources/rules";

export const productionSourceCode="production_source";
export const productionSourceSchema=z.object({environment:z.literal("development"),releaseId:z.string().min(1).max(96),hash:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export function resourceRulesHash(value:unknown){return createHash("sha256").update(JSON.stringify(value,(_k,v)=>v&&typeof v==="object"&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)).digest("hex");}
/** Read the pinned immutable release, never draft values or a second set of numbers. */
export async function readProductionSource(db:Pick<typeof database,"select">,setId:string){
  const [parameter]=await db.select().from(gameParameters).where(and(eq(gameParameters.configSetId,setId),eq(gameParameters.code,productionSourceCode)));
  if(!parameter)return null;
  if(parameter.status!=="active")throw new Error("生产来源引用已停用");
  const binding=productionSourceSchema.parse(parameter.jsonValue);
  // In validation/release transactions this blocks a concurrent resource publication.
  await db.select({environment:resourceRuleDrafts.environment}).from(resourceRuleDrafts).where(eq(resourceRuleDrafts.environment,binding.environment)).for("share");
  const [release]=await db.select().from(resourceRuleReleases).where(and(eq(resourceRuleReleases.id,binding.releaseId),eq(resourceRuleReleases.environment,binding.environment)));
  if(!release)throw new Error("生产来源版本不存在或环境不符");
  const raw=typeof release.rules==="string"?JSON.parse(release.rules):release.rules;
  if(release.hash!==binding.hash||resourceRulesHash(raw)!==binding.hash)throw new Error("生产来源内容校验失败");
  const rules=currentRulesSchema.parse(raw);
  if(rules.releaseId!==binding.releaseId)throw new Error("生产规则版本标识不一致");
  const [latest]=await db.select({id:resourceRuleReleases.id}).from(resourceRuleReleases).where(eq(resourceRuleReleases.environment,binding.environment)).orderBy(desc(resourceRuleReleases.effectiveAt)).limit(1);
  if(latest?.id!==binding.releaseId)throw new Error("资源管理已有更新的发布版本，请重新同步生产来源引用");
  return {binding,rules,effectiveAt:release.effectiveAt};
}
