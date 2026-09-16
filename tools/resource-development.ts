import "dotenv/config";
import { randomBytes } from "node:crypto";
import { mkdir,writeFile,readFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import { ResourceService,hash } from "../server/services/resource-service";

async function main() {
  const target=path.join(process.cwd(),".local/resource-development.json");
  const pool=mysql.createPool(process.env.DATABASE_URL!);
  try {
    try {
      const existing=JSON.parse(await readFile(target,"utf8"));
      for(const token of [existing.playerToken,existing.adminToken]) {
        const [result]=await pool.execute<mysql.ResultSetHeader>("UPDATE resource_session SET expires_at=UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3))*1000+604800000 WHERE token_hash=? AND environment='development'",[hash(token)]);
        if(result.affectedRows!==1)throw new Error("Development session not found");
      }
      console.log("RESOURCE_DEVELOPMENT_RENEWED (same identities and permissions)");return;
    }catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}
    const playerToken=randomBytes(32).toString("hex"),adminToken=randomBytes(32).toString("hex");
    const service=new ResourceService(pool);const ids=await service.provision("development","灵源院独立测试档",playerToken,adminToken);
    await mkdir(path.dirname(target),{recursive:true,mode:0o700});
    await writeFile(target,JSON.stringify({...ids,playerToken,adminToken},null,2),{mode:0o600,flag:"wx"});
    console.log("RESOURCE_DEVELOPMENT_READY",{playerId:ids.playerId,credentialsFile:target});
  }finally{await pool.end();}
}
main().catch(()=>{console.error("RESOURCE_DEVELOPMENT_FAILED");process.exitCode=1;});
