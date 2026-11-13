/**
 * P01 CRM: source-backed editorial evidence, snapshot reconciled 2026-11-13.
 * This is a reading layer, not a new module contract or deployment attestation.
 * No sensitive data, customer records, secrets, tokens or live service access.
 */
const REPO="https://github.com/delmacy/syndes-system";
const FILE=(path)=>REPO+"/blob/main/"+path;
const DOC=(filename)=>FILE("docs/subprojects/P01-crm/"+filename);
const CODE=(filename)=>FILE("modules/core-crm/"+filename);
const evidence=(heading,description,rows,headers=["Elemento","Registro verificado"],references=[])=>({heading,description,headers,rows,references});
export const CRM_EVIDENCE={
  identificacao:{
    intro:"Identidade técnica registrada no manifesto e situação comprovada pela auditoria documental.",
    blocks:[
      evidence("Ficha técnica do módulo","Estas características foram verificadas no manifesto do pacote e na definição de domínio, não em um ambiente de produção.",[
        ["Identificador da unidade","P01 — CRM; pacote @syndes/core-crm"],
        ["Identificador de runtime","crm, versão 0.1.0 na definição do módulo"],
        ["Stack de implementação","TypeScript 5.9.3, NestJS como peer dependency e PostgreSQL"],
        ["Responsabilidade","Pessoas, organizações de relacionamento, notas, tags, histórico e identidades de canais"],
        ["Dependência declarada","platform, no ModuleDefinition"],
        ["Estado de verificação","Auditoria local em checkout b452a03e em 12/11/2026; 29 testes locais aprovados na ocasião, sem Product Gate"]
      ],["Atributo","Evidência no repositório"],[
        {name:"Manifesto do pacote",href:CODE("package.json")},
        {name:"Definição do domínio",href:CODE("src/service.ts")},
        {name:"Checkpoint da auditoria",href:DOC("STATUS.md")}
      ])
    ]
  },
  "visao-geral":{
    intro:"O modelo não é uma lista genérica de clientes: ele diferencia pessoas, empresas de relacionamento, histórico, classificação e referências de canal.",
    blocks:[
      evidence("Fronteiras do CRM","Uma organização comercial cadastrada no CRM é uma entidade de relacionamento; não é um tenant nem uma Platform Organization.",[
        ["Pertence ao CRM","crm_people, crm_organizations, crm_notes, crm_tags, crm_audit e associações"],
        ["Pertence à plataforma","Membership, autenticação, autorização, organizações administrativas e entitlements"],
        ["Área de transição","crm_employees representa legado a reconciliar com Workforce/ERP Lite; migration não aprovada"],
        ["Fora do aceite comprovado","Ativação multi-org e fluxo autenticado ponta a ponta"]
      ],["Fronteira","Responsabilidade"],[
        {name:"Referência técnica do CRM",href:DOC("REFERENCIA-TECNICA.md")},
        {name:"Escopo não aprovado",href:DOC("ESCOPO.md")}
      ])
    ]
  },
  "analise-funcional":{
    intro:"As capacidades abaixo decorrem das operações de serviço e do controller. Os cenários de usuário propostos anteriormente continuam candidatos até aceitação formal.",
    blocks:[
      evidence("Capacidades encontradas no código","Presença de método não garante disponibilização em todas as telas ou ambientes.",[
        ["Pessoas","Criar, consultar, pesquisar, atualizar, arquivar, listar notas e timeline"],
        ["Organizações de relacionamento","Criar, pesquisar, atualizar, arquivar e vincular/desvincular pessoas"],
        ["Classificação","Criar tags, vincular/desvincular tags e listar tags por pessoa"],
        ["Identidade e funcionários legados","Associar canal, consultar suspeitas de duplicidade, consultar employee e canais"],
        ["Intercâmbio","Importar e exportar contatos em CSV"]
      ],["Área","Capacidades identificadas"],[
        {name:"Serviço de domínio",href:CODE("src/service.ts")},
        {name:"Operações complementares",href:CODE("src/extra.ts")},
        {name:"Controller HTTP",href:CODE("src/crm.controller.ts")}
      ]),
      evidence("Critérios verificáveis do domínio","Exemplos de restrições que já estão implementadas no serviço, sem pressupor que a interface as exponha corretamente.",[
        ["Paginação de pessoas","limit de 1 a 100; offset de 0 a 100000; padrão 25 registros"],
        ["Nota de atendimento","Texto obrigatório, limpo e limitado a 5000 caracteres"],
        ["Tag","Rótulo obrigatório de até 64 caracteres"],
        ["Histórico","listTimeline e listNotes limitados a 1–100, padrão 50"],
        ["Exclusão de contato","archivePerson; arquivamento auditável em vez de remoção física imediata"]
      ],["Regra","Validação no código"],[{name:"Validações no CrmService",href:CODE("src/service.ts")}])
    ]
  },
  processos:{
    intro:"É possível descrever fluxos sustentados pelas operações registradas, sem fingir que a integração HTTP e a experiência do usuário já passaram em homologação real.",
    blocks:[
      evidence("Ciclo de registro de relacionamento","A sequência indica a relação entre operações, não a existência de um workflow orquestrado ou automatizado.",[
        ["Entrada","Consulta com listPeople(query,limit,offset) ou criação com createPerson"],
        ["Organização","Criação com createOrganization e vínculo com linkPerson"],
        ["Registro","createNote, tagPerson ou linkChannel conforme contexto autorizado"],
        ["Consulta posterior","getPerson, listNotes e listTimeline"],
        ["Encerramento","archivePerson registra ação auditável em crm_audit"]
      ],["Passo","Operação envolvida"],[{name:"CrmService",href:CODE("src/service.ts")},{name:"Persistência SQL",href:CODE("sql/001_crm_foundation.sql")}]),
      evidence("Identidade WhatsApp: desfechos possíveis","A política distingue associação segura de ambiguidade; não assumir criação automática de contato.",[
        ["Identidade já vinculada e válida","Política pode preservar personId após checagem de escopo"],
        ["Identidade ambígua","Retorno de revisão necessária em vez de associação silenciosa"],
        ["Evento observado","Consumer trata inbox.participant.observed.v1 sob escopo de tenant/organização/workspace"],
        ["Ativação","Consumer opt-in; vínculo transacional e revisão humana continuam pendentes no aceite"]
      ],["Situação","Comportamento/documentação"],[{name:"Política de identidade",href:CODE("src/whatsapp-identity-events.ts")},{name:"Bloqueios atuais",href:DOC("STATUS.md")}])
    ]
  },
  arquitetura:{
    intro:"Os componentes centrais estão separados por responsabilidade. Isso permite que o design mostre como a implementação se conecta sem transformar detalhes internos em requisitos de negócio.",
    blocks:[
      evidence("Mapa de componentes","Os caminhos são evidência de arquivos existentes e suas responsabilidades declaradas.",[
        ["CrmService","src/service.ts — operações e validações do domínio sob CoreKernel.execute"],
        ["PgCrmRepository / Factory","src/postgres.ts — consultas e escrita com mapeamento confiável de banco do tenant"],
        ["CrmExtras / PgCrmExtras","src/extra.ts — atualização, CSV, identidade de canal, funcionários e duplicidade"],
        ["CrmController / CrmHost","src/crm.controller.ts — adaptador HTTP e resolução de contexto"],
        ["CrmHttpModule","src/nest.module.ts — composição NestJS"],
        ["CrmWhatsAppIdentityPolicy / Consumer","src/whatsapp-identity-events.ts — avaliação e reação ao evento de identidade"]
      ],["Componente","Responsabilidade e fonte"],[
        {name:"Serviço",href:CODE("src/service.ts")},
        {name:"Repositório",href:CODE("src/postgres.ts")},
        {name:"Controller",href:CODE("src/crm.controller.ts")},
        {name:"Consumer de canal",href:CODE("src/whatsapp-identity-events.ts")}
      ]),
      evidence("Sequência de autorização antes de persistir","A lógica no serviço avalia contexto, ação e recurso antes de selecionar o repositório tenant-scoped.",[
        ["1 — Contexto","Actor e tenantId vêm do host autenticado; organizationId é opcional no contrato"],
        ["2 — Gate de escrita","scopeWriteAllowed === false impede ações write"],
        ["3 — Permissão","CoreKernel.execute avalia resource/action"],
        ["4 — Dados","Factory seleciona repositório para tenantId e, quando aplicável, organizationId"]
      ],["Ordem","Papel da camada"],[{name:"CrmService.execute",href:CODE("src/service.ts")}])
    ]
  },
  contratos:{
    intro:"O contrato verificável mais útil é o que distingue funções exportadas, rotas declaradas e permissões. Isso evita que o leitor confunda código com uma API pública já homologada.",
    blocks:[
      evidence("Exports estáveis declarados no pacote","A superfície de imports é explícita no package.json. O catálogo abaixo é um inventário de código, não um SLA.",[
        ["@syndes/core-crm","CrmService, CrmRepository, tipos Person/Organization/Note/TimelineEntry, PgCrmRepository e políticas de identidade"],
        ["@syndes/core-crm/plugin","CrmHttpModule, descriptor do plugin, migrations, permissions e assets legados"],
        ["ModuleDefinition","id crm, version 0.1.0, dependencies platform"],
        ["Validações e erros","CrmValidationError, TenantDatabaseMismatchError"]
      ],["Export/artefato","Conteúdo identificado"],[{name:"Manifesto e exports",href:CODE("package.json")},{name:"Index do pacote",href:CODE("src/index.ts")},{name:"Plugin",href:CODE("src/plugin.ts")}]),
      evidence("API HTTP declarada — rota base /v1/tenants/:tenantId/crm","São decorators reais do CrmController. A disponibilidade no host e as respostas 401/403 ainda requerem testes integrados.",[
        ["GET","/capabilities · /people · /people/:id · /organizations · /organizations/:id"],
        ["POST","/people · /organizations · /people/:id/organizations · /tags · /people/:id/tags · /people/:id/notes"],
        ["PATCH","/people/:id · /organizations/:id"],
        ["DELETE","/people/:id · /organizations/:id · /people/:id/organizations/:organizationId · /people/:id/tags/:tagId"],
        ["GET","/tags · /people/:id/notes · /people/:id/timeline · /people/:id/organizations · /people/:id/tags"],
        ["GET","/people/:id/channels · /people/:id/employee · /employees · /exports/csv"],
        ["POST","/people/:id/employee · /people/:id/channels · /duplicates · /imports/csv"]
      ],["Verbo","Paths relativos ao prefixo"],[{name:"Controller HTTP",href:CODE("src/crm.controller.ts")}]),
      evidence("Recursos e permissões do plugin","São recursos descritos no plugin, sujeitos às autorizações reais no Core Kernel e às condições de rollout.",[
        ["crm:context","read"],
        ["crm:people / crm:organizations","read, write"],
        ["crm:relationships","write"],
        ["crm:tags / crm:notes","read, write"],
        ["crm:employees / crm:channels","read, write"]
      ],["Recurso","Ações definidas"],[{name:"Permissões declaradas",href:CODE("src/plugin.ts")}])
    ]
  },
  dados:{
    intro:"A persistência está em arquivos SQL próprios e deve ser executada dentro do banco de cada tenant; não no Control Plane.",
    blocks:[
      evidence("Inventário real das tabelas","Leitura de sql/001–003, sem afirmação de que todas as migrations já foram aplicadas no ambiente atualmente publicado.",[
        ["001 · crm_organizations","Empresas de relacionamento com chave tenant_id + id e índices de nome/documento"],
        ["001 · crm_people","Pessoas, email/telefone, arquivamento e índices de busca"],
        ["001 · crm_person_organizations","Vínculo com chaves estrangeiras de pessoa e organização"],
        ["001 · crm_audit","Registro de ações e histórico, incluindo actor_id e recorded_at"],
        ["002 · crm_tags / crm_person_tags","Tags e vínculo tag–pessoa com unicidade e integridade por tenant"],
        ["002 · crm_notes","Notas vinculadas à pessoa, com autor e data"],
        ["003 · crm_employees","Perfil profissional legado, distinto de conta IAM"],
        ["003 · crm_channel_identities","Identidades externas com unicidade tenant + canal + external_id"]
      ],["Migration/tabela","Papel e integridade"],[
        {name:"SQL 001 — Fundação",href:CODE("sql/001_crm_foundation.sql")},
        {name:"SQL 002 — Tags e notas",href:CODE("sql/002_crm_tags_notes.sql")},
        {name:"SQL 003 — Colaboradores e canais",href:CODE("sql/003_crm_employees_channels.sql")}
      ]),
      evidence("Relações que sustentam a leitura","Estas ligações são materializadas por tabelas próprias, não por campos soltos no cadastro.",[
        ["Pessoa → organização comercial","crm_person_organizations"],
        ["Pessoa → tags","crm_person_tags"],
        ["Pessoa → notas","crm_notes"],
        ["Pessoa → canais externos","crm_channel_identities"],
        ["Pessoa → auditoria","crm_audit por entity_type/entity_id"]
      ],["Relação","Tabela de suporte"],[{name:"Schema do CRM",href:CODE("sql/001_crm_foundation.sql")}])
    ]
  },
  integracoes:{
    intro:"O acoplamento entre CRM, Inbox e identidade de canal deve ser explicitado por contrato e pelo estado do gate — nunca por uma suposição de que um evento publicado já foi consumido.",
    blocks:[
      evidence("Integrações realmente representadas no código","O consumer está implementado como opt-in. O STATUS não comprova cutover real ou revisão humana operacional.",[
        ["Core Kernel","CoreKernel.execute para autorização antes de acessar banco"],
        ["Tenant DB","TrustedTenantDatabaseProvider e repositório por contexto"],
        ["Host NestJS","CrmHttpModule e CrmController"],
        ["Inbox / WhatsApp","CrmWhatsAppIdentityConsumer reage a inbox.participant.observed.v1"],
        ["Control Plane","Identidade, memberships e entitlement pertencem ao domínio de plataforma, não ao CRUD do CRM"]
      ],["Dependência","Contrato/fonte"],[{name:"Consumer de identidade",href:CODE("src/whatsapp-identity-events.ts")},{name:"Contrato de contexto",href:CODE("src/contracts.ts")},{name:"Gates",href:DOC("STATUS.md")}])
    ]
  },
  seguranca:{
    intro:"O código implementa guardas, mas o sistema só poderá ser chamado de homologado após verificar seus comportamentos com identidade real, isolamento e negativas.",
    blocks:[
      evidence("Proteções registradas","O frontend não é a fonte de autoridade para tenant, ator, permissões ou contexto operacional.",[
        ["Autorização","CoreKernel.execute usa actor, tenantId, resource e action"],
        ["Tenant","CrmRepository obtido por tenantId confiável após autorização"],
        ["Multi-organização","SYNDES_MULTI_ORG_ENABLED exige organizationId quando ligado; ativação ainda bloqueada"],
        ["Escopo de escrita","scopeWriteAllowed false nega comandos de escrita"],
        ["Guardas HTTP","Controller utiliza bearer e SelectedScope, com resolução de contexto no host"],
        ["Disponibilidade de banco","TenantDatabaseMismatchError convertido em indisponibilidade HTTP 503"]
      ],["Controle","Evidência e limitação"],[{name:"Serviço e gates",href:CODE("src/service.ts")},{name:"Controller",href:CODE("src/crm.controller.ts")},{name:"Auditoria",href:DOC("STATUS.md")}])
    ]
  },
  interfaces:{
    intro:"As telas e os assets legados existem no repositório; a experiência autenticada do Workspace ainda precisa ser testada com identidades reais.",
    blocks:[
      evidence("Inventário de interfaces encontradas","A existência de componentes prova implementação de código, não experiência homologada em produção.",[
        ["Workspace: visão CRM","apps/workspace-web/src/features/crm.tsx"],
        ["Workspace: detalhe da pessoa","apps/workspace-web/src/features/crm-person-detail.tsx"],
        ["Frontend legado do plugin","modules/core-crm/public/crm.html, app.js e styles.css"],
        ["Manager","Não deve compartilhar sessão nem ler diretamente CRM de outro tenant"],
        ["Critério de aceite pendente","Browser E2E com JWT Keycloak, OpenFGA e tenants separados"]
      ],["Superfície","Estado documental"],[
        {name:"Visão CRM do Workspace",href:FILE("apps/workspace-web/src/features/crm.tsx")},
        {name:"Detalhe da pessoa",href:FILE("apps/workspace-web/src/features/crm-person-detail.tsx")},
        {name:"Assets legados",href:REPO+"/tree/main/modules/core-crm/public"},
        {name:"STATUS",href:DOC("STATUS.md")}
      ])
    ]
  },
  qualidade:{
    intro:"Os números de teste precisam permanecer associados à revisão e ao ambiente onde foram registrados.",
    blocks:[
      evidence("Quadro de evidências de 12/11/2026","Resultado histórico de checkout b452a03e; não confundir com nova execução de módulo no DevServer ou com o aceite do produto.",[
        ["Comando reportado","cd modules/core-crm && npm test"],
        ["Resultado","29 PASS / 0 FAIL, teste local do módulo"],
        ["Código auditado","Checkout b452a03e, DevServer01"],
        ["Não demonstrado nessa auditoria","HTTP com Keycloak/OpenFGA reais, tenants A/B, browser E2E integrado"],
        ["Product Gate","Pendente"],
        ["Cautela operacional","Não aplicar SQL ou habilitar worker apenas porque a documentação possui os arquivos"]
      ],["Evidência","Interpretação"],[{name:"Status auditado",href:DOC("STATUS.md")},{name:"Aceite CRM MVP",href:FILE("docs/product/CORE-CRM-MVP-ACCEPTANCE.md")}])
    ]
  },
  evolucao:{
    intro:"O backlog pertence ao processo de decisão, não deve ser apresentado como trabalho iniciado ou compromisso já aprovado.",
    blocks:[
      evidence("WBS relacionada com estado documentado","O registro de evolução contém associações e estados históricos; antes de executar, validar no WBS mestre e no STATUS atual.",[
        ["50.01","Paridade de CRM/Inbox/WhatsApp entre main e DevServer — PEND na WBS"],
        ["50.02","Homologação CRM E2E com tenant e organização default — BLOQ na WBS"],
        ["50.08","Aceite do fluxo Basic CRM + Inbox + WhatsApp — BLOQ na WBS"],
        ["55.02","Funil de atendimento com 2–8 etapas — domínio relacionado, não capability do CRM automaticamente entregue"],
        ["60.02","Auditoria de migrations multi-organização — BLOQ na WBS"]
      ],["ID","Entregável e estado de origem"],[{name:"Plano de evolução",href:DOC("EVOLUCAO.md")},{name:"WBS mestre",href:FILE("docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md")}]),
      evidence("Validação candidata P01-WP-VAL","Este plano não representa sprint comprometida.",[
        ["P01-VAL-01","JWT/FGA reais, CRUD, consulta, CSV, notas e cenários A/B"],
        ["P01-VAL-02","Revisão de identidade de canal, replay, concorrência e rollback"],
        ["P01-VAL-03","Navegação CRM no Workspace, critérios de aceite e Product Gate"]
      ],["Tarefa candidata","Resultado esperado"],[{name:"Evolução e tarefas",href:DOC("EVOLUO.md".replace("EVOLUO","EVOLUCAO"))}])
    ]
  }
};
export const evidenceIds=Object.keys(CRM_EVIDENCE);
