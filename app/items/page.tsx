import {ItemManager} from '@/components/item-management/ItemManager';
export default async function ItemsPage({searchParams}:{searchParams:Promise<{configSet?:string;tab?:string}>}){
 const {configSet,tab}=await searchParams;
 return <ItemManager key={`${configSet}:${tab}`} initialConfigSet={configSet&&/^[a-z0-9][a-z0-9_-]*$/.test(configSet)?configSet:'v1_0'} initialTab={tab}/>;
}
