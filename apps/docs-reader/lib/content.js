export const REPO = "https://github.com/delmacy/syndes-system";
export const BLUEPRINT = REPO + "/blob/main/docs/blueprint";
export const CRM = REPO + "/blob/main/docs/subprojects/P01-crm";
export const doc = (name) => CRM + "/" + name;
export const code = (name) => REPO + "/blob/main/" + name;
export const domains = [
  {id:"01",name:"Produto e experiências",description:"O que as pessoas usam: relacionamento, atendimento e conversas.",examples:"CRM · Inbox · WhatsApp",pilot:true},
  {id:"02",name:"Plataforma e Core",description:"Identidade, permissões, organizações e serviços compartilhados.",examples:"Identity · Event Bus"},
  {id:"03",name:"Interfaces e aplicações",description:"As experiências do cliente e da administração da plataforma.",examples:"Workspace · Platform Manager"},
  {id:"04",name:"Gestão e operação",description:"Rotinas que sustentam o atendimento, o suporte e a gestão.",examples:"Suporte · Operação"},
  {id:"05",name:"Infraestrutura e qualidade",description:"Dados, hospedagem, segurança, testes e evidências.",examples:"PostgreSQL · CI · Monitoramento"}
];
const ref=(name,href)=>({name,href});
const R={
  status:ref("STATUS — CRM",doc("STATUS.md")),
  scope:ref("Escopo e capacidades",doc("ESCOPO.md")),
  tech:ref("Referência técnica",doc("REFERENCIA-TECNICA.md")),
  evolution:ref("Evolução e WBS",doc("EVOLUCAO.md")),
  operation:ref("Operação e gates",doc("OPERACAO.md")),
  kernel:ref("Código do módulo",REPO+"/tree/main/modules/core-crm"),
  ui:ref("Frontend do Workspace",code("apps/workspace-web/src/features/crm.tsx")),
  sql:ref("Migrações do CRM",REPO+"/tree/main/modules/core-crm/sql")
};
export const crmSections = [
{id:"identificacao",number:"00",title:"Identificação e situação",group:"Entender",eyebrow:"Estado de entrega",
 lead:"Existe implementação de CRM no repositório. A jornada completa, entretanto, ainda não está homologada.",
 paragraphs:["A auditoria técnica de 12 de novembro de 2026 identificou módulo NestJS, serviços TypeScript, persistência PostgreSQL e componentes no Workspace. Registrou 29 testes locais aprovados na revisão realizada.","Não há comprovação equivalente de uma jornada autenticada completa com serviços reais, habilitação multi-organização ou Product Gate. O estado deve continuar parcial até que essas evidências existam."],
 stats:[["Estado","Auditoria parcial"],["Evidência","29 testes locais"],["Product Gate","Pendente"]],references:[R.status,R.tech]},
{id:"visao-geral",number:"01",title:"Visão geral e escopo",group:"Entender",eyebrow:"Por que existe",
 lead:"O CRM preserva o contexto do relacionamento: quem é a pessoa, com quem se relaciona e o que já aconteceu.",
 paragraphs:["O domínio gerencia pessoas, organizações de relacionamento, notas, tags e histórico. Essas organizações comerciais não são as organizações administrativas dos tenants da plataforma.","O escopo funcional normativo continua em discussão. Não transformamos capacidades encontradas no código em funcionalidades aprovadas ou já disponibilizadas para clientes."],
 bullets:["Pessoas e organizações de relacionamento.","Notas, classificações e contexto de atendimento.","Associação a identidades de canais sujeita a verificação."],references:[R.scope,R.tech]},
{id:"analise-funcional",number:"02",title:"Análise funcional",group:"Entender",eyebrow:"Necessidade humana",
 lead:"A análise começa nas tarefas de quem trabalha com o relacionamento, antes de discutir classes ou endpoints.",
 paragraphs:["Localizar uma pessoa, compreender seu contexto e registrar uma nota são ações coerentes com as operações identificadas no serviço. A permissão e a jornada integrada ainda precisam de validação.","As histórias abaixo são hipóteses editoriais para debate. Não representam uma aprovação de escopo."],
 stories:[["Encontrar uma pessoa","Como operador autorizado, quero localizar um contato para continuar um atendimento com contexto."],["Preservar uma interação","Como operador autorizado, quero registrar uma nota para que a informação esteja disponível na próxima interação."],["Revisar vínculos ambíguos","Como responsável autorizado, quero revisar possíveis associações de canal antes de consolidar uma identidade."]],
 references:[R.scope,R.tech]},
{id:"processos",number:"03",title:"Processos e fluxos",group:"Entender",eyebrow:"Da intenção ao resultado",
 lead:"Um fluxo claro apresenta uma ação por vez, com decisões e consequências compreensíveis.",
 paragraphs:["Como percurso conceitual, um operador localiza o contato, verifica o contexto de autorização, consulta informações anteriores e registra uma atualização. Uma identidade vinda de canal externo pode precisar de revisão humana.","É uma sequência de leitura e planejamento; não constitui evidência de que todas as etapas estejam integradas em ambiente real."],
 steps:["Localizar","Confirmar contexto","Registrar interação","Preservar histórico"],references:[R.scope,R.status]},
{id:"arquitetura",number:"04",title:"Arquitetura interna",group:"Construir",eyebrow:"Como o módulo é organizado",
 lead:"Regras de CRM, entrada HTTP e armazenamento têm responsabilidades distintas para facilitar evolução e testes.",
 paragraphs:["A referência descreve CrmService, PgCrmRepository e plugin CrmHttpModule em NestJS. O código inclui operações de criação, consulta, associação, arquivamento, classificação e notas.","O desenho deve evitar acoplamento direto entre outros módulos e as classes internas do CRM. Dependências devem respeitar os exports públicos do pacote."],
 bullets:["Serviço de domínio em modules/core-crm/src/service.ts.","Repositório PostgreSQL em src/postgres.ts.","Integração ao host pelo plugin NestJS."],references:[R.tech,R.kernel]},
{id:"contratos",number:"05",title:"Contratos e interfaces técnicas",group:"Construir",eyebrow:"Compromissos entre sistemas",
 lead:"Um contrato define expectativas de integração; não é sinônimo de função interna nem de endpoint operacional.",
 paragraphs:["A raiz do pacote publica tipos e serviços previstos no manifesto, enquanto ./plugin oferece a integração NestJS. A referência também registra um controller HTTP presente no código.","A simples presença de um controller ou de versões de eventos no catálogo não prova rota autenticada no host ou consumo efetivo. Esse compromisso depende de testes integrados e gates."],
 bullets:["Exports do pacote e do entrypoint ./plugin.","Interfaces internas distintas de APIs HTTP.","Eventos entre CRM e Inbox dependentes dos contratos e das condições de ativação."],references:[R.tech,ref("Manifesto do pacote",code("modules/core-crm/package.json"))]},
{id:"dados",number:"06",title:"Dados e persistência",group:"Construir",eyebrow:"O que precisa ser preservado",
 lead:"Os dados comerciais pertencem ao CRM no banco de tenant. Governança da plataforma é outra responsabilidade.",
 paragraphs:["Pessoas, organizações de relacionamento, vínculos e auditoria compõem a fundação do modelo. Evoluções posteriores incluem notas, tags e informações relacionadas a canais.","crm_employees é uma herança arquitetural em análise. Sua presença não autoriza a remoção ou execução de migrations."],
 table:{headers:["Conjunto","Finalidade","Origem"],rows:[["Pessoas e organizações","Registros e vínculos comerciais","SQL 001"],["Tags e notas","Classificação e contexto","SQL 002"],["Colaboradores e canais","Estrutura transicional sob revisão","SQL 003"]]},references:[R.tech,R.sql]},
{id:"integracoes",number:"07",title:"Integrações e dependências",group:"Construir",eyebrow:"Fronteiras do sistema",
 lead:"O CRM coopera com outros módulos por contratos, sem assumir a propriedade interna de WhatsApp, Inbox ou Control Plane.",
 paragraphs:["A referência aponta políticas de resolução de identidade de canal, incluindo revisão de ambiguidades, e um consumidor opt-in. Isso não equivale a um pipeline universalmente ativo.","As dependências de permissões, organizações e eventos precisam de contratos e ambientes comprovados para fechar o fluxo de atendimento."],
 bullets:["WhatsApp e Inbox: informações de canal sob políticas de identidade.","Core Kernel e Control Plane: contexto confiável de tenancy e autorização.","Event Bus: versão, idempotência e evidência de consumo antes da ativação."],references:[R.tech,ref("Event Platform C06",REPO+"/tree/main/docs/subprojects/C06-event-platform")]},
{id:"seguranca",number:"08",title:"Segurança e configuração",group:"Verificar",eyebrow:"Limites de acesso",
 lead:"Nenhum dado de relacionamento pode depender somente do tenant ou da organização informados pela interface.",
 paragraphs:["O CRM contém guardas de contexto e depende de contratos de autorização. Os testes reais de negação 401/403 com Keycloak e OpenFGA, entretanto, ainda aparecem como lacuna de homologação.","Segredos, chaves e endereços internos ficam fora deste site de leitura pública. Configurações operacionais permanecem documentadas nos ambientes autorizados."],references:[R.status,R.tech]},
{id:"interfaces",number:"09",title:"Interfaces do usuário",group:"Verificar",eyebrow:"O que a pessoa vê",
 lead:"A interface deve priorizar a tarefa humana: encontrar registros, entender o histórico e atuar com segurança.",
 paragraphs:["Há componentes de CRM no Workspace, incluindo a experiência de detalhe da pessoa. O código existente não substitui testes E2E com identidade, permissões e banco real.","O Platform Manager não deve compartilhar sessão nem consultar diretamente dados internos de um tenant como se estivesse operando no seu Workspace."],
 references:[R.ui,ref("Detalhe da pessoa",code("apps/workspace-web/src/features/crm-person-detail.tsx"))]},
{id:"qualidade",number:"10",title:"Testes e operação",group:"Verificar",eyebrow:"Prova antes do aceite",
 lead:"Teste local, integração real e homologação são evidências distintas.",
 paragraphs:["A auditoria registrou 29 testes locais passando no módulo. Faltam provas equivalentes do fluxo integrado com Keycloak, OpenFGA, tenants separados e navegação real no browser.","A homologação precisa identificar SHA, ambiente, cenários positivos e negativos, isolamento de acesso, procedimentos de recuperação e aceite explícito."],
 bullets:["Teste local do pacote: registrado.","Integração autenticada real: pendente.","Browser E2E e Product Gate: pendentes."],references:[R.status,R.operation]},
{id:"evolucao",number:"11",title:"Planejamento e evolução",group:"Verificar",eyebrow:"O que evoluir depois",
 lead:"Uma melhoria precisa de objetivo verificável, dependências claras e um resultado que possa ser aceito.",
 paragraphs:["O planejamento relaciona CRM às WBS 50.02 e 50.08, com dependências de identidade, canal e multi-organização. As tarefas P01-VAL são candidatas, não atribuições automáticas.","A prioridade é concluir uma validação real de ponta a ponta antes de ampliar a superfície de capacidades."],
 milestones:[["P01-VAL-01","Validar HTTP e permissões reais"],["P01-VAL-02","Revisar identidades de canal ambíguas"],["P01-VAL-03","Validar navegação e fechar Product Gate"]],references:[R.evolution,R.status]}
];
export const sectionIds=crmSections.map((s)=>s.id);
