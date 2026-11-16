import SiteShell from "@/components/site-shell";
import MasterDossierReader from "@/components/master-dossier-reader";
import {loadMasterDossier} from "@/lib/master-dossiers";
export default function InboxMasterPage(){return <SiteShell><MasterDossierReader dossier={loadMasterDossier("inbox")}/></SiteShell>}
