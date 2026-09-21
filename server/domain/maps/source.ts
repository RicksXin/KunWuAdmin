import {z} from 'zod';
const finite=z.number().finite();
const point=z.tuple([finite,finite]);
const objectSchema=z.object({id:z.string().regex(/^[a-z0-9_]+$/),kind:z.string().min(1),x:finite,y:finite,title:z.string(),description:z.string().optional(),encounterId:z.string().optional(),refreshType:z.string().optional()}).passthrough();
export const continuousMapSchema=z.object({id:z.literal('map_01'),mapId:z.literal('map_01'),schemaVersion:z.literal(4),name:z.string(),nameKey:z.string(),worldSize:z.tuple([finite.positive(),finite.positive()]),entryX:finite,entryY:finite,coordinateSystem:z.literal('top_left_y_down_world'),positionVersion:z.literal(2),spawn:point,objects:z.array(objectSchema).length(31),visual:z.record(z.string(),z.unknown())}).passthrough().superRefine((m,ctx)=>{
 const inside=(x:number,y:number)=>x>=0&&y>=0&&x<=m.worldSize[0]&&y<=m.worldSize[1];
 if(!inside(m.entryX,m.entryY))ctx.addIssue({code:'custom',message:'入口越界'});
 if(m.spawn[0]!==m.entryX||m.spawn[1]!==m.entryY)ctx.addIssue({code:'custom',message:'出生点与入口不一致'});
 if(new Set(m.objects.map(o=>o.id)).size!==m.objects.length)ctx.addIssue({code:'custom',message:'对象编码重复'});
 for(const o of m.objects){if(!inside(o.x,o.y))ctx.addIssue({code:'custom',message:`对象${o.id}越界`});for(const key of ['activationPoints','additionalMarkerCells'])if(o[key]){const points=z.array(point).safeParse(o[key]);if(!points.success||points.data.some(p=>!inside(p[0],p[1])))ctx.addIssue({code:'custom',message:`对象${o.id}附加落点非法`});}}
});
export type ContinuousMap=z.infer<typeof continuousMapSchema>;
export const regionsSchema=z.object({canvas:z.object({width:finite.positive(),height:finite.positive()}).passthrough(),annotations:z.object({layers:z.array(z.object({id:z.string(),label:z.string(),shapes:z.array(z.record(z.string(),z.unknown()))}).passthrough())}).passthrough()}).passthrough();
export const canonical=(value:unknown):string=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export function without(source:Record<string,unknown>,keys:string[]){return Object.fromEntries(Object.entries(source).filter(([key])=>!keys.includes(key)));}
export function splitMap(source:unknown,regions:unknown){
 const map=continuousMapSchema.parse(source);const regionDocument=regionsSchema.parse(regions);
 return {map,regionDocument,header:{code:map.id,nameKey:map.nameKey,displayName:map.name,mapNumber:1,schemaVersion:map.schemaVersion,scenePath:String(map.visual.scenePath??''),width:map.worldSize[0],height:map.worldSize[1],activeWidth:map.worldSize[0],activeHeight:map.worldSize[1],entryX:map.entryX,entryY:map.entryY,visualConfig:map.visual,terrainDocument:{kind:'continuous_regions',document:regionDocument},runtimeDocument:without(map,['id','mapId','schemaVersion','name','nameKey','worldSize','entryX','entryY','visual','objects'])}};
}
export function restoreMap(header:Record<string,unknown>,objects:Record<string,unknown>[]){
 return continuousMapSchema.parse({...header.runtimeDocument as object,id:header.code,mapId:header.code,schemaVersion:header.schemaVersion,name:header.displayName,nameKey:header.nameKey,worldSize:[header.activeWidth,header.activeHeight],entryX:header.entryX,entryY:header.entryY,visual:header.visualConfig,objects});
}
export function restoreObject(prototype:Record<string,unknown>,placement:Record<string,unknown>){
 const full={...prototype.interactionConfig as object,id:placement.instanceCode,x:placement.x,y:placement.y,kind:prototype.kind,title:prototype.title,description:prototype.description,refreshType:prototype.refreshType};
 const keys=(placement.overrideConfig as {sourceKeys?:string[]}|null)?.sourceKeys;
 return keys?Object.fromEntries(Object.entries(full).filter(([k])=>keys.includes(k))):full;
}
/** Includes encounters triggered inside dialogue choices, not only direct markers. */
export function encounterReferences(value:unknown):string[]{
 if(!value||typeof value!=='object')return [];
 const result:string[]=[];
 for(const [key,v]of Object.entries(value)){if(['encounterId','startEncounterId'].includes(key)&&typeof v==='string')result.push(v);else result.push(...encounterReferences(v));}
 return [...new Set(result)];
}
