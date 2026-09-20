import {ConfigDashboard} from '@/components/config-dashboard/ConfigDashboard';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{configSet?:string}>}){
 const {configSet}=await searchParams;
 const set=typeof configSet==='string'&&/^[a-z0-9][a-z0-9_-]*$/.test(configSet)?configSet:'v1_0';
 return <ConfigDashboard initialConfigSet={set} view="maps"/>;
}
