import SiteShell from "@/components/site-shell";
import InboxActionReader from "@/components/inbox-action-reader";
import {inboxActionCatalog,loadInboxAction} from "@/lib/inbox-dossier";
export function generateStaticParams(){return inboxActionCatalog().actions.map(a=>({id:a.id}))}
export default async function InboxActionPage({params}){const {id}=await params;return <SiteShell><InboxActionReader dossier={loadInboxAction(id)}/></SiteShell>}
