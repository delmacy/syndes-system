import { notFound } from "next/navigation";
import SiteShell from "@/components/site-shell";
import PilotModuleReader from "@/components/pilot-module-reader";
import { PILOT_MODULES, pilotModuleBySlug } from "@/lib/pilot-modules";

export function generateStaticParams(){
 return PILOT_MODULES.map(({slug})=>({slug}));
}
export default async function ModulePage({params}){
 const {slug}=await params;
 if(!pilotModuleBySlug(slug))notFound();
 return <SiteShell><PilotModuleReader slug={slug}/></SiteShell>;
}
