import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import mysql,{type RowDataPacket} from "mysql2/promise";
import { ResourceService,hash,type Actor,type Operation } from "../../server/services/resource-service";
import { createFarm,type FarmState } from "../../server/domain/resources/settle";
import { amountSchema,baselineCatalog,baselineRules } from "../../server/domain/resources/rules";

type Snapshot={state:FarmState;stateVersion:string};
async function fixture(budget=20000) {
  const pool=mysql.createPool({uri:process.env.DATABASE_URL,connectionLimit:5});const service=new ResourceService(pool,budget);
  const environment=`test-${randomBytes(6).toString("hex")}`,pt=randomBytes(32).toString("hex"),at=randomBytes(32).toString("hex");
  const ids=await service.provision(environment,"自动化测试专用",pt,at);
  return {pool,service,environment,pt,at,...ids,player:await service.authenticate(pt,"player"),admin:await service.authenticate(at,"admin")};
}
async function execute(f:Awaited<ReturnType<typeof fixture>>,actor:Actor,operation:Operation,id=randomBytes(16).toString("hex")) {
  let result=await f.service.execute(actor,f.playerId,id,operation);
  for(let i=0;result.status===202;i++){assert.ok(i<10000);result=await f.service.execute(actor,f.playerId,id,operation);}
  return {...result,snapshot:result.body as unknown as Snapshot};
}
async function fund(f:Awaited<ReturnType<typeof fixture>>,amount="400") {
  const sync=await execute(f,f.admin,{type:"sync"});return execute(f,f.admin,{type:"adjust",asset:"spiritGrain",mode:"set",amount,reason:"自动化测试准备",expectedVersion:sync.snapshot.stateVersion,expectedBalance:sync.snapshot.state.balances.spiritGrain});
}
test("DB auth rejects wrong kind, expired token and permission/environment crossing",async()=>{
  const f=await fixture();try {
    await assert.rejects(()=>f.service.authenticate(f.pt,"admin"),/UNAUTHENTICATED/);
    await assert.rejects(()=>f.service.list({...f.admin,permissions:[]}),/FORBIDDEN/);
    await assert.rejects(()=>f.service.execute({...f.player,environment:"test-other"},f.playerId,"crossenv000",{type:"sync"}),/RULES_UNAVAILABLE/);
    await f.pool.query("UPDATE resource_session SET expires_at=1 WHERE token_hash=?",[hash(f.pt)]);
    await assert.rejects(()=>f.service.authenticate(f.pt,"player"),/UNAUTHENTICATED/);
  }finally{await f.pool.end();}
});
test("DB duplicate concurrent recruit charges exactly once and conflicting key fails",async()=>{
  const f=await fixture();try {
    const prep=await fund(f),command={type:"recruit" as const,expectedVersion:prep.snapshot.stateVersion};
    const result=await Promise.all([f.service.execute(f.player,f.playerId,"same-request-001",command),f.service.execute(f.player,f.playerId,"same-request-001",command)]);
    assert.deepEqual(result[0],result[1]);const state=(result[0].body as unknown as Snapshot).state;
    assert.equal(state.workers.length,7);assert.equal(state.balances.spiritGrain,"100");
    await assert.rejects(()=>f.service.execute(f.player,f.playerId,"same-request-001",{type:"sync"}),/IDEMPOTENCY_CONFLICT/);
    const replay=await f.service.request(f.player,f.playerId,"same-request-001");assert.deepEqual(replay.body,result[0].body);
  }finally{await f.pool.end();}
});
test("DB different concurrent commands with same version cannot lose updates",async()=>{
  const f=await fixture();try {
    const prep=await fund(f),command={type:"recruit" as const,expectedVersion:prep.snapshot.stateVersion};
    const result=await Promise.allSettled([f.service.execute(f.player,f.playerId,"request-A001",command),f.service.execute(f.player,f.playerId,"request-B001",command)]);
    assert.equal(result.filter(x=>x.status==="fulfilled").length,1);assert.equal((await execute(f,f.player,{type:"sync"})).snapshot.state.workers.length,7);
  }finally{await f.pool.end();}
});
test("DB invalid debit rolls back production/state/request atomically",async()=>{
  const f=await fixture();try {
    const [before]=await f.pool.query<RowDataPacket[]>("SELECT state,version FROM resource_player WHERE id=?",[f.playerId]);
    await assert.rejects(()=>execute(f,f.player,{type:"recruit",expectedVersion:"1"}),/INSUFFICIENT_RESOURCE/);
    const [after]=await f.pool.query<RowDataPacket[]>("SELECT state,version FROM resource_player WHERE id=?",[f.playerId]);assert.deepEqual(after,before);
  }finally{await f.pool.end();}
});
test("DB administrator stale balance is rejected; audit and ledger agree",async()=>{
  const f=await fixture();try {
    const result=await fund(f);assert.equal(result.status,200);
    const conflict=await execute(f,f.admin,{type:"adjust",asset:"spiritGrain",mode:"set",amount:"0",expectedVersion:result.snapshot.stateVersion,expectedBalance:"120",reason:"故意过期的余额"});assert.equal(conflict.status,409);
    assert.equal((await execute(f,f.player,{type:"sync"})).snapshot.state.balances.spiritGrain,"400");
    const [audit]=await f.pool.query<RowDataPacket[]>("SELECT details FROM resource_admin_audit WHERE environment=? AND action='adjust'",[f.environment]);assert.equal(audit.length,1);
    const ledger=await f.service.ledgerPage(f.admin,f.playerId);assert.ok(ledger.some(x=>x.delta==="280"));
  }finally{await f.pool.end();}
});
test("DB configuration approval is invalidated on save; release is immutable",async()=>{
  const f=await fixture();try {
    const rules=structuredClone(baselineRules);rules.recruitCosts=["10","20","30","40","50","60"];rules.catalog=structuredClone(baselineCatalog);rules.catalog[0].displayName="目录发布测试";
    await f.service.configure(f.admin,{action:"save",revision:1,rules,reason:"数值测试"});
    await assert.rejects(()=>f.service.configure(f.admin,{action:"publish",revision:2,reason:"未审核"}),/RELEASE_BLOCKED/);
    await f.service.configure(f.admin,{action:"approve",revision:2,reason:"测试审核"});
    await f.service.configure(f.admin,{action:"publish",revision:2,reason:"测试发布"});
    const config=await f.service.configuration(f.admin);assert.equal(config.releases.length,2);assert.deepEqual((config.releases[0].rules as typeof rules).catalog,rules.catalog);
    const snapshot=await execute(f,f.player,{type:"sync"});assert.equal((snapshot.body as unknown as {rulesSummary:typeof rules}).rulesSummary.catalog?.[0].displayName,"目录发布测试");
    assert.deepEqual((snapshot.body as unknown as {rulesSummary:typeof rules}).rulesSummary.recruitCosts,rules.recruitCosts);
    const recruited=await execute(f,f.player,{type:"recruit",expectedVersion:snapshot.snapshot.stateVersion});
    assert.equal(recruited.snapshot.state.balances.spiritGrain,"110");
    await assert.rejects(()=>f.service.configure(f.admin,{action:"save",revision:2,rules:{...rules,recruitCosts:["10","10","30","40","50","60"]},reason:"相邻费用相同"}),/严格高于/);
    await f.service.configure(f.admin,{action:"save",revision:2,rules,reason:"后续编辑"});
    await assert.rejects(()=>f.service.configure(f.admin,{action:"publish",revision:3,reason:"过期审核"}),/RELEASE_BLOCKED/);
  }finally{await f.pool.end();}
});
test("DB trusted rewards are idempotent across distinct requests",async()=>{
  const f=await fixture();try {
    const command={type:"reward" as const,claimId:"quest-time-dew-1",dewLevel:1 as const,highestMap:3};
    await execute(f,f.admin,command);const again=await execute(f,f.admin,command);assert.equal(again.snapshot.state.dewLevel,1);assert.equal(again.snapshot.state.highestMap,3);
    await assert.rejects(()=>execute(f,f.player,command),/FORBIDDEN/);
  }finally{await f.pool.end();}
});
test("DB persistent continuation survives service restart and blocks competing writes",async()=>{
  const f=await fixture(1);try {
    const state=createFarm(Date.now()-120000);state.workers[0].job="spiritGrain";
    await f.pool.query("UPDATE resource_player SET state=? WHERE id=?",[JSON.stringify(state),f.playerId]);
    const key="long-sync-0001",first=await f.service.execute(f.player,f.playerId,key,{type:"sync"});assert.equal(first.status,202);
    await assert.rejects(()=>f.service.execute(f.player,f.playerId,"other-sync-0001",{type:"sync"}),/PLAYER_BUSY/);
    const restarted=new ResourceService(f.pool,1);let result=first;
    for(let i=0;result.status===202;i++){assert.ok(i<20);result=await restarted.execute(f.player,f.playerId,key,{type:"sync"});}
    assert.equal(result.status,200);assert.ok(BigInt((result.body as unknown as Snapshot).state.balances.spiritGrain)>=BigInt(124));
  }finally{await f.pool.end();}
});
test("invalid amount returns validation failure, not BigInt exception",()=>{assert.equal(amountSchema.safeParse("abc").success,false);});

 test("DB audit insertion failure rolls back admin balance and ledger",async()=>{
  const f=await fixture();try {
    const synced=await execute(f,f.admin,{type:"sync"});
    const wrapped=new Proxy(f.pool,{get(target,property){
      if(property==="getConnection")return async()=>{
        const connection=await target.getConnection();
        return new Proxy(connection,{get(c,key){
          if(key==="query")return (sql:string,args:unknown[])=>{
            if(sql.startsWith("INSERT INTO resource_admin_audit"))throw new Error("AUDIT_FAULT_INJECTION");
            return c.query(sql,args);
          };
          const value=Reflect.get(c,key);return typeof value==="function"?value.bind(c):value;
        }});
      };
      const value=Reflect.get(target,property);return typeof value==="function"?value.bind(target):value;
    }});
    const service=new ResourceService(wrapped);
    await assert.rejects(()=>service.execute(f.admin,f.playerId,"audit-failure-001",{type:"adjust",asset:"spiritGrain",mode:"add",amount:"10",expectedVersion:synced.snapshot.stateVersion,expectedBalance:"120",reason:"事务回滚验证"}),/AUDIT_FAULT_INJECTION/);
    const final=await execute(f,f.player,{type:"sync"});assert.equal(final.snapshot.state.balances.spiritGrain,"120");
    const [entries]=await f.pool.query<RowDataPacket[]>("SELECT id FROM resource_transaction WHERE player_id=? AND reason='adjust'",[f.playerId]);assert.equal(entries.length,0);
  }finally{await f.pool.end();}
});
