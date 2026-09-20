import {NextResponse} from 'next/server';
import {z} from 'zod';
import {domainViews,type DomainView} from '@/server/domain/admin/ownership';
import {listConfigModuleEntities,ConfigSetNotFoundError,configModuleSchema} from '@/server/services/config-query';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{domain:string}>}){
 const {domain}=await params;
 if(!Object.prototype.hasOwnProperty.call(domainViews,domain))return NextResponse.json({message:'业务入口不存在'},{status:404});
 const query=z.string().regex(/^[a-z0-9][a-z0-9_-]*$/).safeParse(new URL(request.url).searchParams.get('configSet')??'v1_0');
 if(!query.success)return NextResponse.json({message:'配置集参数无效'},{status:400});
 try{
  const view=domainViews[domain as DomainView];
  const modules=await Promise.all(view.modules.map(module=>listConfigModuleEntities(query.data,configModuleSchema.parse(module))));
  const all: {code:string;name:string;editable?:boolean;rows:Record<string,unknown>[]}[]=[];
  for(const result of modules)all.push(...result.groups);
  const groups=view.groups.flatMap(code=>all.filter(group=>group.code===code));
  return NextResponse.json({configSet:query.data,domain,groups});
 }catch(error){
  if(error instanceof ConfigSetNotFoundError)return NextResponse.json({message:'配置集不存在'},{status:404});
  console.error('CONFIG_DOMAIN_FAILED',error);return NextResponse.json({message:'业务配置读取失败'},{status:500});
 }
}
