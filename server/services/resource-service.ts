import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { amountSchema, assetCodes, baselineRules, currentRulesSchema, rulesSchema, type ProductionRules } from "../domain/resources/rules";
import { applyCommand, capacity, createFarm, emptyReport, settle, type Command, type FarmState, type Report } from "../domain/resources/settle";

export type Actor = {id:string; kind:"player"|"admin"; environment:string; permissions:string[]};
export class ResourceError extends Error { constructor(public code:string,public status=422) {super(code);} }
export const hash = (value:string) => createHash("sha256").update(value).digest("hex");
const canonical=(v:unknown):string => JSON.stringify(v,(_k,x)=>x&&typeof x==="object"&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const decode=<T>(v:unknown):T => typeof v==="string"?JSON.parse(v):v as T;
async function rows(c:Pool|PoolConnection,sql:string,args:unknown[]=[]):Promise<RowDataPacket[]> { const [r]=await c.query<RowDataPacket[]>(sql,args);return r; }
const atTime=async(c:PoolConnection)=>Number((await rows(c,"SELECT FLOOR(UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3))*1000) AS now_ms"))[0].now_ms);
export const playerCommandSchema=z.discriminatedUnion("type",[
  z.object({type:z.literal("sync")}).strict(),
  z.object({type:z.literal("allocation"),allocations:z.record(z.enum(assetCodes),z.number().int().min(0).max(12)),expectedVersion:amountSchema}).strict(),
  z.object({type:z.literal("recruit"),expectedVersion:amountSchema}).strict(),
  z.object({type:z.literal("storage"),asset:z.enum(assetCodes),expectedVersion:amountSchema}).strict(),
]);
export const adjustSchema=z.object({type:z.literal("adjust"),asset:z.enum(assetCodes),mode:z.enum(["add","subtract","set"]),amount:amountSchema,
  expectedVersion:amountSchema,expectedBalance:amountSchema,reason:z.string().trim().min(2).max(500)}).strict();
export type Operation=z.infer<typeof playerCommandSchema>|z.infer<typeof adjustSchema>|{type:"reward";claimId:string;dewLevel?:1|2;highestMap?:number};
type Summary=Omit<Report,"events">;
const summarize=(report:Report):Summary=>({produced:report.produced,upkeep:report.upkeep,stored:report.stored,overflow:report.overflow,iterations:report.iterations});
function merge(a:Summary,b:Report):Summary { const next=structuredClone(a); for(const k of ["produced","upkeep","stored","overflow"] as const) for(const code of assetCodes) next[k][code]=String(BigInt(a[k][code])+BigInt(b[k][code]));next.iterations+=b.iterations;return next; }
type Pending={actorId:string;requestId:string;payloadHash:string;targetMs:number;summary:Summary};
const material=(s:FarmState)=>canonical({balances:s.balances,levels:s.storageLevels,workers:s.workers.map(w=>({id:w.id,job:w.job})),dew:s.dewLevel,map:s.highestMap,rules:s.rulesId});
function permitted(actor:Actor,permission:string) {if(actor.kind!=="admin"||!actor.permissions.includes(permission))throw new ResourceError("FORBIDDEN",403);}

export class ResourceService {
  constructor(public pool:Pool, private budget=20000) {}
  async authenticate(token:string,kind:"player"|"admin"):Promise<Actor> {
    if(!token||token.length>256)throw new ResourceError("UNAUTHENTICATED",401);
    const s=(await rows(this.pool,"SELECT * FROM resource_session WHERE token_hash=? AND actor_kind=? AND expires_at > UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3))*1000",[hash(token),kind]))[0];
    if(!s)throw new ResourceError("UNAUTHENTICATED",401);
    return {id:s.actor_id,kind,environment:s.environment,permissions:decode<string[]>(s.permissions)};
  }
  private async transaction<T>(fn:(c:PoolConnection)=>Promise<T>):Promise<T> {
    for(let attempt=0;;attempt++) {
      const c=await this.pool.getConnection();
      try {await c.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");await c.beginTransaction();const result=await fn(c);await c.commit();return result;}
      catch(e) {await c.rollback(); const code=(e as {code?:string}).code;if(attempt<2&&(code==="ER_LOCK_DEADLOCK"||code==="ER_LOCK_WAIT_TIMEOUT"))continue;throw e;}
      finally {c.release();}
    }
  }
  private async history(c:PoolConnection,env:string) {
    const releases=await rows(c,"SELECT * FROM resource_rule_release WHERE environment=? ORDER BY effective_at",[env]);
    if(!releases.length)throw new ResourceError("RULES_UNAVAILABLE",503);
    return releases.map(x=>{
      const raw=decode<ProductionRules>(x.rules);if(hash(canonical(raw))!==x.hash)throw new ResourceError("RULES_UNAVAILABLE",503);
      return {atMs:Number(x.effective_at),rules:rulesSchema.parse(raw)};
    });
  }
  private async audit(c:PoolConnection,actor:Actor,action:string,reason:string,details:unknown,now:number) {
    await c.query("INSERT INTO resource_admin_audit (id,actor_id,environment,action,at_ms,reason,details) VALUES (?,?,?,?,?,?,?)",[randomUUID(),actor.id,actor.environment,action,now,reason,JSON.stringify(details)]);
  }
  private async ledger(c:PoolConnection,actor:Actor,playerId:string,key:string,reason:string,before:FarmState,after:FarmState,report:Summary,now:number) {
    if(reason==="production"&&assetCodes.every(code=>before.balances[code]===after.balances[code]&&report.produced[code]==="0"&&report.upkeep[code]==="0"))return;
    const id=randomUUID();
    await c.query("INSERT INTO resource_transaction (id,player_id,actor_id,request_id,at_ms,reason,details) VALUES (?,?,?,?,?,?,?)",[id,playerId,actor.id,key,now,reason,JSON.stringify({report,rulesId:after.rulesId,from:before.time,to:after.time})]);
    for(const code of assetCodes) {const delta=BigInt(after.balances[code])-BigInt(before.balances[code]); if(delta===BigInt(0))continue;
      await c.query("INSERT INTO resource_ledger (id,transaction_id,asset_code,before_amount,after_amount,delta) VALUES (?,?,?,?,?,?)",[randomUUID(),id,code,before.balances[code],after.balances[code],String(delta)]);
    }
  }
  private snapshot(state:FarmState,version:string,rules:ProductionRules,serverTimeMs:number) {
    return {schemaVersion:1,stateVersion:version,serverTimeMs,state,
      capacities:Object.fromEntries(assetCodes.map(code=>[code,String(capacity(state,code,rules))])),rulesSummary:rules};
  }
  async execute(actor:Actor,playerId:string,key:string,operation:Operation) {
    if(!/^[A-Za-z0-9_-]{8,64}$/.test(key))throw new ResourceError("INVALID_REQUEST_ID",400);
    if(actor.kind==="player"&&(actor.id!==playerId||operation.type==="adjust"||operation.type==="reward"))throw new ResourceError("FORBIDDEN",403);
    if(actor.kind==="admin")permitted(actor,operation.type==="adjust"?"players.resources.adjust":operation.type==="reward"?"players.resources.reward":"players.resources.read");
    const payloadHash=hash(canonical(operation));
    return this.transaction(async c=>{
      const lock=(await rows(c,"SELECT environment FROM resource_rule_draft WHERE environment=? FOR SHARE",[actor.environment]))[0];
      if(!lock)throw new ResourceError("RULES_UNAVAILABLE",503);
      const row=(await rows(c,"SELECT * FROM resource_player WHERE id=? AND environment=? AND status='active' FOR UPDATE",[playerId,actor.environment]))[0];
      if(!row)throw new ResourceError("PLAYER_NOT_FOUND",404);
      const stored=(await rows(c,"SELECT * FROM resource_request WHERE player_id=? AND actor_id=? AND request_id=?",[playerId,actor.id,key]))[0];
      if(stored&&stored.payload_hash!==payloadHash)throw new ResourceError("IDEMPOTENCY_CONFLICT",409);
      if(stored&&stored.http_status!==202)return {status:stored.http_status,body:decode<Record<string,unknown>>(stored.response)};
      const pending=decode<Pending|null>(row.pending);
      if(pending&&(pending.actorId!==actor.id||pending.requestId!==key))throw new ResourceError("PLAYER_BUSY",409);
      if(!pending&&operation.type!=="sync"&&operation.type!=="reward"&&String(row.version)!==operation.expectedVersion)throw new ResourceError("STATE_CONFLICT",409);
      const before=decode<FarmState>(row.state), target=pending?.targetMs??await atTime(c), history=await this.history(c,actor.environment);
      if(history[0].atMs>Number(before.time[0])/Number(before.time[1]))throw new ResourceError("RULES_UNAVAILABLE",503);
      const advanced=settle(before,target,history[0].rules,history,this.budget);
      let state=advanced.state;
      const rules=[...history].reverse().find(a=>a.atMs<=Number(state.time[0])/Number(state.time[1]))!.rules;
      let version=BigInt(row.version)+(material(before)!==material(state)?BigInt(1):BigInt(0));
      const summary=merge(pending?.summary??summarize(emptyReport()),advanced.report);
      const syncSnapshot=this.snapshot(state,String(version),rules,target);
      let status=advanced.complete?200:202, error:string|undefined;
      await this.ledger(c,actor,playerId,key,"production",before,state,summarize(advanced.report),target);
      if(advanced.complete&&operation.type!=="sync") {
        if(operation.type==="adjust"&&(String(version)!==operation.expectedVersion||state.balances[operation.asset]!==operation.expectedBalance)) {status=409;error="STATE_CONFLICT";}
        else {
          let updated:{state:FarmState;report:Report};
          if(operation.type==="reward") {
            const claim=(await rows(c,"SELECT payload_hash FROM resource_claim WHERE player_id=? AND claim_id=?",[playerId,operation.claimId]))[0];
            if(claim&&claim.payload_hash!==payloadHash)throw new ResourceError("CLAIM_CONFLICT",409);
            updated={state:structuredClone(state),report:emptyReport()};
            if(!claim) {
              if(operation.dewLevel)updated=applyCommand(updated.state,{type:"dew",level:operation.dewLevel},rules);
              if(operation.highestMap)updated.state.highestMap=Math.max(updated.state.highestMap,operation.highestMap);
              await c.query("INSERT INTO resource_claim (player_id,claim_id,payload_hash,request_id) VALUES (?,?,?,?)",[playerId,operation.claimId,payloadHash,key]);
            }
          } else updated=applyCommand(state,operation as Command,rules);
          await this.ledger(c,actor,playerId,key,operation.type,state,updated.state,summarize(updated.report),target);
          if(material(state)!==material(updated.state))version++;
          if(actor.kind==="admin")await this.audit(c,actor,operation.type,operation.type==="adjust"?operation.reason:"受信任奖励结算",{playerId,key,operation,before:state.balances,after:updated.state.balances},target);
          state=updated.state;
        }
      }
      const nextPending=advanced.complete?null:{actorId:actor.id,requestId:key,payloadHash,targetMs:target,summary};
      const body=error?{error:{code:error,message:"状态已变化，请刷新后重新确认",requestId:key},latestSnapshot:syncSnapshot}:
        {...this.snapshot(state,String(version),rules,target),requestId:key,settlement:summary,complete:advanced.complete,retryAfterMs:advanced.complete?0:100};
      await c.query("UPDATE resource_player SET state=?,version=?,pending=? WHERE id=?",[JSON.stringify(state),String(version),nextPending?JSON.stringify(nextPending):null,playerId]);
      await c.query("INSERT INTO resource_request (player_id,actor_id,request_id,payload_hash,response,http_status) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE response=VALUES(response),http_status=VALUES(http_status)",[playerId,actor.id,key,payloadHash,JSON.stringify(body),status]);
      return {status,body};
    });
  }
  async request(actor:Actor,playerId:string,key:string) {
    if(actor.kind==="player"&&actor.id!==playerId)throw new ResourceError("FORBIDDEN",403);
    if(actor.kind==="admin")permitted(actor,"players.resources.read");
    const r=(await rows(this.pool,"SELECT r.* FROM resource_request r JOIN resource_player p ON p.id=r.player_id WHERE r.player_id=? AND r.actor_id=? AND r.request_id=? AND p.environment=?",[playerId,actor.id,key,actor.environment]))[0];
    if(!r)throw new ResourceError("REQUEST_NOT_FOUND",404);return {status:r.http_status,body:decode(r.response)};
  }
  async list(actor:Actor) {permitted(actor,"players.resources.read");return rows(this.pool,"SELECT id,label,CAST(version AS CHAR) AS version,status FROM resource_player WHERE environment=? ORDER BY label,id LIMIT 100",[actor.environment]);}
  async ledgerPage(actor:Actor,playerId:string,beforeMs=Number.MAX_SAFE_INTEGER) {
    permitted(actor,"players.resources.read");
    return rows(this.pool,"SELECT t.*,l.asset_code,l.before_amount,l.after_amount,l.delta FROM resource_transaction t JOIN resource_player p ON p.id=t.player_id LEFT JOIN resource_ledger l ON l.transaction_id=t.id WHERE t.player_id=? AND p.environment=? AND t.at_ms<=? ORDER BY t.at_ms DESC,t.id DESC LIMIT 100",[playerId,actor.environment,beforeMs]);
  }
  async configuration(actor:Actor) {
    permitted(actor,"config.read");
    const draft=(await rows(this.pool,"SELECT * FROM resource_rule_draft WHERE environment=?",[actor.environment]))[0];
    const releases=await rows(this.pool,"SELECT id,effective_at,hash,rules FROM resource_rule_release WHERE environment=? ORDER BY effective_at DESC LIMIT 30",[actor.environment]);
    return {draft:draft?{...draft,rules:decode(draft.rules)}:null,releases:releases.map(r=>({...r,rules:decode(r.rules)}))};
  }
  async configure(actor:Actor,input:{action:"save"|"approve"|"publish";revision:number;rules?:ProductionRules;reason:string}) {
    permitted(actor,input.action==="save"?"config.write":input.action==="approve"?"release.review":"release.build");
    return this.transaction(async c=>{
      const row=(await rows(c,"SELECT * FROM resource_rule_draft WHERE environment=? FOR UPDATE",[actor.environment]))[0];
      if(!row||row.revision!==input.revision)throw new ResourceError("STATE_CONFLICT",409);
      const now=await atTime(c);
      if(input.action==="save") {
        const rules=currentRulesSchema.parse(input.rules);
        await c.query("UPDATE resource_rule_draft SET rules=?,revision=revision+1,status='draft',approved_revision=NULL WHERE environment=?",[JSON.stringify(rules),actor.environment]);
      } else if(input.action==="approve") {
        currentRulesSchema.parse(decode(row.rules));await c.query("UPDATE resource_rule_draft SET status='approved',approved_revision=revision WHERE environment=?",[actor.environment]);
      } else {
        if(row.status!=="approved"||row.approved_revision!==row.revision)throw new ResourceError("RELEASE_BLOCKED",409);
        const rules=currentRulesSchema.parse(decode(row.rules)); rules.releaseId=randomUUID();
        await c.query("INSERT INTO resource_rule_release (id,environment,effective_at,rules,hash,actor_id) VALUES (?,?,?,?,?,?)",[rules.releaseId,actor.environment,now,JSON.stringify(rules),hash(canonical(rules)),actor.id]);
        await c.query("UPDATE resource_rule_draft SET status='published' WHERE environment=?",[actor.environment]);
      }
      await this.audit(c,actor,`resource.rules.${input.action}`,input.reason,{revision:row.revision,rules:input.rules??decode(row.rules)},now);
      return {ok:true};
    });
  }
  /** CLI/test provisioning only: never exposed to unauthenticated HTTP. */
  async provision(environment:string,label:string,playerToken:string,adminToken:string) {
    if(!/^(development|test-[a-z0-9-]{1,18})$/.test(environment))throw new ResourceError("DEVELOPMENT_ONLY",403);
    return this.transaction(async c=>{
      const now=await atTime(c),playerId=randomUUID(),adminId=randomUUID();
      await c.query("INSERT IGNORE INTO resource_rule_draft (environment,revision,rules,status,approved_revision) VALUES (?,1,?,'published',1)",[environment,JSON.stringify(baselineRules)]);
      await c.query("INSERT IGNORE INTO resource_rule_release (id,environment,effective_at,rules,hash,actor_id) VALUES (?,?,?,?,?,?)",[`${environment}-baseline`,environment,0,JSON.stringify(baselineRules),hash(canonical(baselineRules)),adminId]);
      const state=createFarm(now);
      await c.query("INSERT INTO resource_player (id,environment,label,version,state,status) VALUES (?,?,?,1,?,'active')",[playerId,environment,label,JSON.stringify(state)]);
      const permissions=["players.resources.read","players.resources.adjust","players.resources.reward","config.read","config.write","release.review","release.build"];
      for(const [id,kind,token,perms] of [[playerId,"player",playerToken,[]],[adminId,"admin",adminToken,permissions]] as const)
        await c.query("INSERT INTO resource_session (token_hash,actor_id,actor_kind,environment,permissions,expires_at) VALUES (?,?,?,?,?,?)",[hash(token),id,kind,environment,JSON.stringify(perms),now+7*86400000]);
      return {playerId,adminId};
    });
  }
}
