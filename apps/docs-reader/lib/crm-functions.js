/**
 * Navigation is by CRM reader workflow, not by internal engineering disciplines.
 * Every original editorial section belongs to exactly one function, preserving
 * the canonical twelve topic IDs and every source reference.
 *
 * A "function" is a documentation category, not a production enablement claim.
 */
export const crmFunctions=[
  {id:"visao",title:"Visão geral",description:"O propósito do CRM, seus limites e a situação comprovada.",sections:["identificacao","visao-geral"]},
  {id:"cadastros",title:"Cadastros",description:"Pessoas, organizações comerciais, vínculos, dados e regras de registro.",sections:["analise-funcional","dados"]},
  {id:"atendimento",title:"Atendimento",description:"Contexto, histórico, notas, canais e interfaces que apoiam o atendimento. O funil completo depende de outros módulos e de homologação.",sections:["processos","interfaces"]},
  {id:"validacoes",title:"Validações",description:"Autorização, isolamento, testes, evidências e limitações reais.",sections:["seguranca","qualidade"]},
  {id:"integracoes",title:"Integrações",description:"Componentes internos, APIs, contratos, eventos e dependências.",sections:["arquitetura","contratos","integracoes"]},
  {id:"evolucao",title:"Evolução",description:"Pendências, WBS e metas candidatas, sem tratar planejamento como entrega.",sections:["evolucao"]}
];
export const crmFunctionForSection=(sectionId)=>crmFunctions.find(group=>group.sections.includes(sectionId));
