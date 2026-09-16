import "dotenv/config";
import { randomBytes } from "node:crypto";
import { mkdtemp,writeFile,rm,readFile } from "node:fs/promises";
import { tmpdir,homedir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import mysql from "mysql2/promise";
import { ResourceService,hash } from "../server/services/resource-service";
import type { FarmState } from "../server/domain/resources/settle";

async function digest(file:string){try{return hash((await readFile(file)).toString("base64"));}catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return null;throw e;}}
async function main() {
  const pool=mysql.createPool(process.env.DATABASE_URL!),directory=await mkdtemp(path.join(tmpdir(),"kunwu-resource-e2e-"));
  try {
    const service=new ResourceService(pool),playerToken=randomBytes(32).toString("hex"),adminToken=randomBytes(32).toString("hex");
    const ids=await service.provision(`test-${randomBytes(6).toString("hex")}`,"Godot端到端专用",playerToken,adminToken);
    const admin=await service.authenticate(adminToken,"admin");
    for(const [asset,amount] of [["spiritGrain","400"],["spiritWood","300"]] as const) {
      const sync=await service.execute(admin,ids.playerId,randomBytes(16).toString("hex"),{type:"sync"});
      const snap=sync.body as unknown as {stateVersion:string;state:FarmState};
      await service.execute(admin,ids.playerId,randomBytes(16).toString("hex"),{type:"adjust",asset,mode:"set",amount,expectedVersion:snap.stateVersion,expectedBalance:snap.state.balances[asset],reason:"Godot独立验收准备"});
    }
    const credentials=path.join(directory,"credentials.json");await writeFile(credentials,JSON.stringify({playerToken}),{mode:0o600});
    const profile=path.join(homedir(),"Library/Application Support/Godot/app_userdata/昆吾禁地/kunwu_profile.json"),before=await digest(profile);
    const code=await new Promise<number>(resolve=>{
      const child=spawn("python3",[path.resolve("../KunWuGodot/tools/run_resource_online_test.py"),"--headless-full"],{env:{...process.env,KUNWU_RESOURCE_CREDENTIALS:credentials},stdio:"inherit"});
      child.on("error",()=>resolve(1));child.on("exit",code=>resolve(code??1));
    });
    if(code!==0)throw new Error("Godot E2E failed");if(before!==await digest(profile))throw new Error("Real profile changed");
    console.log("GODOT_RESOURCE_E2E_AND_PROFILE_HASH_OK");
  } finally {await pool.end();await rm(directory,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e instanceof Error?e.message:"E2E failed");process.exitCode=1;});
