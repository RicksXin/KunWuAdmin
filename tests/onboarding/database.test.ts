import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import {eq,desc} from "drizzle-orm";
import {v7 as uuid} from "uuid";
import {database,databasePool} from "../../server/db/client";
import {configSets,gameParameters,gameAssets,resourceRuleReleases} from "../../db/schema";
import {readProductionSource,productionSourceCode,resourceRulesHash} from "../../server/services/config-production";
import {compileConfigModules} from "../../server/compiler/config-compiler";

test("生产编译直接保留已发布规则、阶梯费用和无限离线；坏hash与过期绑定阻断",async()=>{
  const id=uuid();
  try{
    const releases=await database.select().from(resourceRuleReleases).where(eq(resourceRuleReleases.environment,"development")).orderBy(desc(resourceRuleReleases.effectiveAt)).limit(2);
    assert.ok(releases[0],"需要已有本地资源服务发布版本");
    const release=releases[0],binding={environment:"development",releaseId:release.id,hash:release.hash};
    await database.insert(configSets).values({id,code:`test_prod_${id.replaceAll("-","")}`,name:"生产来源测试"});
    await database.insert(gameParameters).values({configSetId:id,code:productionSourceCode,valueType:"json",jsonValue:binding});
    const source=await readProductionSource(database,id);assert.ok(source);
    assert.equal(resourceRulesHash(source.rules),release.hash);assert.equal(source.rules.recruitCosts.length,6);assert.equal(source.rules.offlinePolicy,"unbounded");
    for(const job of source.rules.jobs){assert.equal(job.output,"1");assert.equal(job.cycles,1);await database.insert(gameAssets).values({configSetId:id,code:job.code,nameKey:job.code,assetType:"production_resource"});}
    const modules=await compileConfigModules(database,id,1,0);
    const economy=modules.find(m=>m.moduleCode==="economy")!.payload as {productionConfig:unknown;productionSource:unknown;rules:unknown[];jobs:unknown[]};
    assert.deepEqual(economy.productionConfig,source.rules);assert.deepEqual(economy.productionSource,binding);
    assert.deepEqual(economy.rules,[]);assert.deepEqual(economy.jobs,[]);
    await database.update(gameParameters).set({jsonValue:{...binding,hash:"0".repeat(64)}}).where(eq(gameParameters.configSetId,id));
    await assert.rejects(()=>readProductionSource(database,id),/校验失败/);
    if(releases[1]){
      await database.update(gameParameters).set({jsonValue:{...binding,releaseId:releases[1].id,hash:releases[1].hash}}).where(eq(gameParameters.configSetId,id));
      await assert.rejects(()=>readProductionSource(database,id));
    }
    await database.update(gameParameters).set({jsonValue:{...binding,environment:"production"}}).where(eq(gameParameters.configSetId,id));
    await assert.rejects(()=>readProductionSource(database,id));
  }finally{
    await database.delete(gameAssets).where(eq(gameAssets.configSetId,id));await database.delete(gameParameters).where(eq(gameParameters.configSetId,id));await database.delete(configSets).where(eq(configSets.id,id));await databasePool.end();
  }
});
