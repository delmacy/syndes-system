import SiteShell from "@/components/site-shell";
import MasterDossierReader from "@/components/master-dossier-reader";
import {loadMasterDossier} from "@/lib/master-dossiers";

export default function AtendimentoMasterPage(){
 return <SiteShell><MasterDossierReader dossier={loadMasterDossier("atendimentos")}/></SiteShell>;
}
