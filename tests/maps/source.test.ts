import assert from 'node:assert/strict';
import {test} from 'node:test';
import {splitMap,restoreMap,restoreObject,canonical,without,encounterReferences} from '../../server/domain/maps/source';
function fixture(){return {id:'map_01',mapId:'map_01',schemaVersion:4,name:'测试地图',nameKey:'map.map_01',worldSize:[897,1938.5411681914145],entryX:450.25,entryY:1890.875,spawn:[450.25,1890.875],coordinateSystem:'top_left_y_down_world',positionVersion:2,visual:{scenePath:'res://scenes/maps/map_01.tscn'},dynamicBlockers:[{id:'gate',polygon:[[0,195],[897,207]],stateKey:'boss.defeated'}],objects:Array.from({length:31},(_,i)=>({id:`o_${i}`,kind:'resource',title:'灵木',x:100.125+i,y:1000.0625,choices:[{id:'gather',effects:{rewards:[{itemId:'spiritWood',firstAmount:18,repeatAmount:9}]},requirements:{mapStateEquals:{lamp:true}}}]}))};}
const regions={canvas:{width:2488,height:5692},annotations:{layers:[{id:'collision',label:'碰撞层',shapes:[{points:[{x:1,y:2},{x:3,y:4}]}]}]}};
test('连续坐标、嵌套交互与门禁完整往返，不补写原本没有的字段',()=>{
 const source=fixture();const {map,header}=splitMap(source,regions);
 const restored=restoreMap(header,map.objects.map(o=>restoreObject({kind:o.kind,title:o.title,description:null,refreshType:'permanent',interactionConfig:without(o,['id','x','y','kind','title','description','refreshType'])},{instanceCode:o.id,x:o.x,y:o.y,overrideConfig:{sourceKeys:Object.keys(o)}})));
 assert.equal(canonical(restored),canonical(source));assert.equal(restored.worldSize[1],1938.5411681914145);assert.equal(restored.objects[0].x,100.125);
});
test('拒绝越界、重复对象、出生点不一致及错误坐标体系',()=>{
 for(const mutate of [(m:ReturnType<typeof fixture>)=>{m.objects[0].y=2000;},(m:ReturnType<typeof fixture>)=>{m.objects[1].id=m.objects[0].id;},(m:ReturnType<typeof fixture>)=>{m.spawn[0]=0;},(m:ReturnType<typeof fixture>)=>{m.coordinateSystem='grid';}]){const m=fixture();mutate(m);assert.throws(()=>splitMap(m,regions));}
});
test('剧情选项中的战斗引用被识别并去重，状态键不作为战斗引用',()=>{
 assert.deepEqual(encounterReferences({encounterId:'a',choices:[{startEncounterId:'b'},{startEncounterId:'b',requirements:{'encounters.c.dead':true}}]}),['a','b']);
});
