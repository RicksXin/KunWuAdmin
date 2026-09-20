import {CultivatorManager} from '@/components/cultivator-management/CultivatorManager';
export default async function CultivatorsPage({searchParams}:{searchParams:Promise<{configSet?:string}>}){
 const {configSet}=await searchParams;
 return <CultivatorManager key={configSet} initialConfigSet={configSet&&/^[a-z0-9][a-z0-9_-]*$/.test(configSet)?configSet:'v1_0'}/>;
}
