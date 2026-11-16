import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT="docs/subprojects/";
const CONFIG={
  crm:{
    id:"P01",name:"CRM",subtitle:"Relacionamento e cadastro",
    folder:"P01-crm",back:"/modulos/crm",backLabel:"Voltar às funções e ações do CRM",
    state:"Auditoria técnica parcial · não homologado",
    paths:["MATRIZ-ACOES.md","INVENTARIO-INTEGRAL.md","DIAGRAMAS.md","STATUS.md"]
  },
  inbox:{
    id:"P02",name:"Inbox",subtitle:"Fila, mensagens, operadores e integração por eventos",
    folder:"P02-inbox",back:"/",backLabel:"Voltar à Biblioteca",
    state:"Documentação reconciliada · operação e Product Gate NÃO HOMOLOGADOS",
    actionIndex:"/modulos/inbox/acoes",
    paths:["MATRIZ-ACOES.md","INVENTARIO-TECNICO.md","DIAGRAMAS.md","STATUS.md"]
  },
  atendimentos:{
    id:"P05",name:"Gestão de Atendimentos",subtitle:"Funis, protocolos e operação de atendimentos",
    folder:"P05-gestao-de-atendimentos",back:"/",backLabel:"Voltar à Biblioteca",
    state:"Código identificado · documentação técnica em validação · homologação pendente",
    paths:["REFERENCIA-TECNICA.md","ESCOPO.md","EVOLUCAO.md","STATUS.md"]
  }
};
export const MASTER_GROUPS=Object.freeze([
  {id:"identidade",title:"Propósito e domínio",numbers:["00","01","02","03"]},
  {id:"arquitetura",title:"Arquitetura e contratos",numbers:["04","05","06","07","08"]},
  {id:"seguranca",title:"Segurança e experiência",numbers:["09","10","11","12"]},
  {id:"qualidade",title:"Qualidade e evolução",numbers:["13","14","15","16","17"]},
  {id:"continuidade",title:"Execução e histórico",numbers:["18","19","20","21"]}
]);

export function parseMasterMarkdown(raw){
  const headers=[...raw.matchAll(/^## ([0-9]{2}) · ([^\n]+)\s*$/gm)];
  if(headers.length!==22||headers.some((x,i)=>Number(x[1])!==i))
    throw new Error("A ficha precisa preservar os 22 blocos 00–21 do template v1.0.0");
  return headers.map((match,index)=>{
    const start=match.index+match[0].length;
    const end=headers[index+1]?.index??raw.length;
    return {number:match[1],title:match[2].trim(),body:raw.slice(start,end).trim()};
  });
}

export function loadMasterDossier(slug){
  const cfg=CONFIG[slug];
  if(!cfg)throw new Error("Módulo fora do recorte de Ficha Mestre: "+slug);
  const rel=ROOT+cfg.folder+"/FICHA-MODULO.md";
  const physical=resolve(process.cwd(),"../..",rel);
  const source=readFileSync(physical,"utf8");
  const sections=parseMasterMarkdown(source);
  return {
    ...cfg,
    slug,sections,groups:MASTER_GROUPS,
    github:"https://github.com/delmacy/syndes-system/blob/main/",
    documentPath:rel,
    sources:cfg.paths.map(p=>({label:p,path:ROOT+cfg.folder+"/"+p})),
    description:source.split("\n").slice(0,4).find(line=>line.startsWith("> "))?.slice(2)||"Ficha versionada no GitHub"
  };
}
