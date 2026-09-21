import 'server-only';
import {and,eq} from 'drizzle-orm';
import {database} from '@/server/db/client';
import {mapDefinitions,mapObjectPlacements,mapObjectPrototypes} from '@/db/schema';
import {restoreMap,restoreObject} from '@/server/domain/maps/source';
export async function readMapSource(db:Pick<typeof database,'select'>,setId:string,code:string){
 const [map]=await db.select().from(mapDefinitions).where(and(eq(mapDefinitions.configSetId,setId),eq(mapDefinitions.code,code)));
 if(!map?.runtimeDocument)return null;
 const rows=await db.select({placement:mapObjectPlacements,prototype:mapObjectPrototypes}).from(mapObjectPlacements).innerJoin(mapObjectPrototypes,eq(mapObjectPlacements.prototypeId,mapObjectPrototypes.id)).where(eq(mapObjectPlacements.mapId,map.id)).orderBy(mapObjectPrototypes.sortOrder);
 const source=restoreMap(map,rows.map(r=>restoreObject(r.prototype,r.placement)));
 const terrain=map.terrainDocument as {kind:string;document:unknown};
 return {source,regions:terrain.document,status:map.status,revision:map.revision,bindings:rows.filter(r=>r.prototype.encounterId).map(r=>({objectId:r.placement.instanceCode,encounterId:r.prototype.encounterId})),notes:map.notes};
}
