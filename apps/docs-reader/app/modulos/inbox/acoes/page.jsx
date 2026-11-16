import SiteShell from "@/components/site-shell";
import InboxActionIndex from "@/components/inbox-action-index";
import {inboxActionCatalog} from "@/lib/inbox-dossier";
export default function InboxActionsPage(){return <SiteShell><InboxActionIndex catalog={inboxActionCatalog()}/></SiteShell>}
