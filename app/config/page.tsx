import { ConfigDashboard } from "@/components/config-dashboard/ConfigDashboard";

export const dynamic = "force-dynamic";

export default async function ConfigPage({searchParams}:{searchParams:Promise<{configSet?:string}>}) {
  const {configSet}=await searchParams;
  const initialConfigSet=typeof configSet==="string"&&/^[a-z0-9][a-z0-9_-]*$/.test(configSet)?configSet:"v1_0";
  return <ConfigDashboard initialConfigSet={initialConfigSet} />;
}
