// Biblioteca Syndes — recorte inicial de cinco áreas. Estados e ownership vêm dos registros canônicos.
// As ações abaixo organizam leitura; não são novas capacidades, aprovações nem alegações de deploy.
const BASE="https://github.com/delmacy/syndes-system/blob/main/";
const doc=(folder,file)=>({label:file,path:"docs/"+folder+"/"+file,url:BASE+"docs/"+folder+"/"+file});
const code=(path)=>({label:path.split("/").pop(),path,url:BASE+path});
const unit=(folder)=>({
 scope:doc("subprojects/"+folder,"ESCOPO.md"),
 status:doc("subprojects/"+folder,"STATUS.md"),
 tech:doc("subprojects/"+folder,"REFERENCIA-TECNICA.md"),
 plan:doc("subprojects/"+folder,"EVOLUCAO.md"),
 operation:doc("subprojects/"+folder,"OPERACAO.md"),
 decisions:doc("subprojects/"+folder,"HISTORICO.md"),
});
const P14=unit("P14-platform-core"),A08=unit("A08-core-kernel"),A04=unit("A04-core-host");
const WA=unit("P03-whatsapp"),KC=unit("C03-identity-keycloak"),FGA=unit("C04-authorization-openfga"),BAO=unit("C05-secrets-openbao");
const BP=(name)=>doc("blueprint",name);
const action=(id,title,area,objective,flow,contract,data,api,security,tests,operation,risks,sources)=>({
 id,title,area,objective,flow,contract,data,api,security,tests,operation,risks,sources,
 state:"Documentado no código ou nas fontes; homologação por verificar"
});
export const PILOT_MODULES=[
 {
 slug:"core-platform",code:"P14 / A08 / A04",title:"Core Platform",subtitle:"Fronteiras, contratos e execução da plataforma",state:"Arquitetura distribuída · auditoria parcial",
 intro:"P14 define a fronteira arquitetural. O Core Kernel (A08) fornece contratos e ports. O Core Host (A04) compõe os módulos e integra identidade, autorização e infraestrutura. P14 não é um serviço executável.",
 ownership:"P14 — governança arquitetural; A08 — biblioteca executável; A04 — processo NestJS e adapters. Control Plane, Identity, FGA e módulos de domínio conservam seus próprios owners.",
 groups:[
 {id:"fronteiras",title:"Fronteiras",description:"Identificar ownership e evitar que o Core absorva regras dos módulos."},
 {id:"kernel",title:"Core Kernel",description:"Contratos, registry, tenancy e autorização abstrata."},
 {id:"host",title:"Core Host",description:"Composição, configuração, autenticação e execução."},
 {id:"eventos",title:"Eventos e lifecycle",description:"Contratos de eventos, módulos e gates operacionais."},
 {id:"evolucao",title:"Planejamento",description:"Composição por perfis, testes e pendências de aceite."}
 ],
 actions:[
 action("core-boundaries","Distinguir Core, Host e owners","fronteiras","Definir quem responde por contrato, runtime, autorização e domínio sem inventar uma API P14.",
 ["Consultar P14 para decisões de arquitetura.","Conferir qual owner implementa o comportamento.","Consultar os contratos públicos desse owner antes de projetar mudanças."],
 "P14: política arquitetural; A08: @syndes/core-kernel; A04: Core Host.","P14 não possui tabelas, migrations ou frontend próprios.","P14 não expõe API HTTP própria.","Não transferir IAM/Control, segredos ou regras de negócio ao P14.","Verificar dependências e testes no owner real.","Sem runtime P14; registrar decisão e impactos no owner correto.","Perfis CMP e sign-off de composição pendentes.",[P14.scope,P14.tech,P14.status,code("modules/platform-core/AGENTS.md")]),
 action("core-registry","Registrar e ordenar módulos","kernel","Permitir composição explícita de módulos confiáveis com versões, dependências e rejeição de ciclos.",
 ["ModuleRegistry.register valida definições.","ordered resolve dependências e rejeita ciclos/ausências.","Kernel.start inicializa hooks na ordem esperada."],
 "ModuleRegistry.register, ordered, has; CoreKernel.start.","Registry em memória; sem schema PostgreSQL próprio A08.","Sem API HTTP própria no Kernel.","Entradas precisam ser trusted; não aceitar specifier arbitrário vindo do cliente.","Consultar testes de module-registry e kernel; homologação por SHA.","Pacote TypeScript privado @syndes/core-kernel.","Composição por perfis/instâncias ainda não homologada.",[A08.tech,code("packages/core-kernel/src/module-registry.ts"),code("packages/core-kernel/src/kernel.ts"),A08.status]),
 action("core-access","Executar portas de tenancy e autorização","kernel","Autorizar a operação antes da execução por meio dos ports e do contexto confiável.",
 ["Receber Actor e tenantId confiáveis.","Checar TenancyPort.canAccessTenant.","Checar AuthorizationPort.canAccess e negar acesso indevido.","Executar handler somente após permissão."],
 "CoreKernel.execute e executeModule; TenancyPort, AuthorizationPort, ModuleAccessPort.","Sem ownership de banco no Kernel; adapters do Host acessam Control e tenant DB.","O Host publica suas próprias rotas; o Kernel não é um controller.","executeModule requer gate de módulo explicitamente integrado; não inferir enforcement universal.","Testar negativa, pertença ao tenant e gates por operação.","Falhar fechado em acesso negado.","Verificar adapters e migrations de controle antes de habilitar enforcement.",[A08.tech,A04.tech,code("packages/core-kernel/src/kernel.ts"),code("packages/core-kernel/src/contracts.ts")]),
 action("core-host-compose","Compor plugins confiáveis no Host","host","Montar os módulos instalados e seus contratos no processo NestJS.",
 ["Carregar lista trusted do Host.","Validar dependências, rotas e migrations do plugin.","Integrar controllers, assets e adapters.","Verificar readiness e acesso."],
 "CrmHttpModule e outros plugins por module-host; descriptors via ./plugin.","Bancos e migrations pertencem aos owners; config/modules.json indica composição, não ENABLED.","GET /healthz, GET /readyz, GET /modules/:moduleId/config; POST /v1/tenants/:tenantId/authorize são rotas declaradas pelo Host.","JWT, membership Control, FGA e entitlement são verificações distintas.","Testar startup inválido, dependências, readiness e JWT/FGA.","Nenhum deploy de Host é implicado por esta ficha.","Service module e perfis por instância ainda têm gates.",[A04.tech,P14.status,code("apps/core-host/src/module-host.ts"),code("apps/core-host/config/modules.json"),code("apps/core-host/src/main.ts")]),
 action("core-event-contracts","Versionar eventos e integração entre módulos","eventos","Manter contratos tipados de envelopes, publicação e execução com isolamento de escopo.",
 ["Validar envelope platform/control.","Publicar com transação outbox quando aplicável.","Despachar por worker habilitado e consumidores idempotentes."],
 "validatePlatformEvent, validateControlPlaneEvent; adapters event publisher/dispatcher no Host.","Persistência de eventos/entregas pertence às migrations e owners da plataforma de eventos.","Sem API HTTP de eventos pertencente a P14.","Service grants e tenant/org/workspace devem ser checados antes do worker.","Testes de envelope, replay, falhas e idempotência por owner.","Worker admission/composição não significa scheduler ativado.","Homologação de service grants, restore e dispatcher em runtime pendente.",[P14.tech,code("packages/core-kernel/src/platform-events.ts"),code("apps/core-host/src/platform-event-dispatcher.ts"),unit("C06-event-platform").status]),
 action("core-profile-gates","Planejar composição e aceites do Core","evolucao","Manter WBS de perfis CMP separada de implementação executada.",
 ["Consultar ADR de composição.","Registrar capacidade necessária e seu owner.","Planejar dependências e critérios de aceite.","Executar somente alteração aprovada em escopo separado."],
 "P14/CMP: decisão de arquitetura; A04/A08: contratos do código.","Sem SQL próprio P14.","Sem API própria P14.","Implantação e gates IAM não são deduzidos de CI.","Sign-off, CI, imagens, rollback, grants e restore exigem provas distintas.","Não marcar CMP concluído por documentação.","CMP-01/02 e perfis independentes ainda pendentes.",[P14.plan,P14.status,doc("engineering","ADR-COMPOSICAO-MODULAR-CORE-20261111.md"),doc("engineering","WBS-COMPOSICAO-MODULAR-CORE-20261111.md")])
 ],
 sources:[P14.scope,P14.status,P14.tech,A08.tech,A04.tech],
 diagram:{nodes:["Workspace / Manager","Core Host A04","Core Kernel A08","Control / FGA / IAM","Tenant PostgreSQL","Módulos de domínio"],edges:[[0,1],[1,2],[2,3],[1,5],[5,4]]}
 },
 {
 slug:"blueprint",code:"BLUEPRINT",title:"Blueprint Geral",subtitle:"Visão transversal do Syndes System",state:"Índice e propostas · não aprovado como baseline único",
 intro:"O Blueprint agrega catálogo, arquitetura, dados, ambientes e planejamento. É a visão para decidir prioridades entre módulos; não representa um runtime nem substitui PRDs, AGENTS.md e contratos aprovados.",
 ownership:"Blueprint é documentação transversal. A propriedade de código, API, dados e segurança continua com cada módulo/unidade de trabalho.",
 groups:[
 {id:"visao",title:"Visão e escopo",description:"Princípios, MVP e decisões estruturais."},
 {id:"catalogo",title:"Catálogo",description:"Limites e responsabilidades das unidades."},
 {id:"arquitetura",title:"Arquitetura",description:"Camadas, dados, APIs e dependências."},
 {id:"planejamento",title:"Planejamento",description:"Roadmap, WBS e progressão por evidências."},
 {id:"ambientes",title:"Ambientes",description:"Hospedagem, configuração e estados de implantação."}
 ],
 actions:[
 action("blueprint-scope","Consultar visão geral e escopo aprovado","visao","Distinguir a visão aspiracional das entregas autorizadas e do MVP.",
 ["Ler o índice do Blueprint.","Cruzar com AGENTS.md e PRDs vigentes.","Separar proposta de decisão aprovada.","Registrar perguntas por tópico."],
 "Registros executivos e documentos de produto; não contrato de módulo.","Não possui banco ou migrations próprios.","Não fornece API HTTP.","Requisitos de segurança pertencem aos owners IAM/Control.","Exigir referências do requisito e critério de aceite aprovado.","Material em revisão; não promover automaticamente.","Falta baseline de Blueprint Geral único aprovado.",[BP("README.md"),BP("PROJETOS.md"),code("AGENTS.md")]),
 action("blueprint-module-catalog","Localizar módulos, owners e fronteiras","catalogo","Navegar o conjunto de unidades sem repetir descrição nem transferir ownership.",
 ["Conferir catálogo de unidades.","Selecionar owner e fonte de implementação.","Consultar escopo, status e WBS somente do módulo necessário."],
 "catalog/work-units.json e catálogo editorial dos módulos.","Bancos descritos pelos owners específicos.","APIs e exports definidos por cada owner.","Tenancy e permissões não são herdadas automaticamente por constar no catálogo.","Conferir IDs, caminhos e owners antes de iniciar tarefa.","Documentação de descoberta; sem impacto em runtime.","58+ unidades não implicam 58 módulos executáveis.",[BP("CATALOGO-MODULOS.md"),BP("README.md"),code("catalog/work-units.json")]),
 action("blueprint-layers","Inspecionar arquitetura por camadas","arquitetura","Ter mapa consolidado de frontend, serviços, contratos, segurança e persistência.",
 ["Selecionar camada de interesse.","Navegar para documento técnico correspondente.","Conferir implementações e decisões na fonte canônica."],
 "Mapa técnico por camadas + documentos APIS/DADOS.","DADOS.md e migrations dos owners são fontes complementares.","APIS.md é mapa, não especificação operacional homologada.","Não confundir IAM, FGA, Control e dados do cliente.","Conferir contratos e testes nos módulos concretos.","Sem operação própria do Blueprint.","Manter mapa consistente com o código ao avançar por módulos.",[BP("MAPA-TECNICO-POR-CAMADAS.md"),BP("APIS.md"),BP("DADOS.md")]),
 action("blueprint-roadmap","Consultar roadmap, projeto e WBS","planejamento","Escolher o próximo incremento conforme dependências e o MVP, sem perder a trilha de decisão.",
 ["Ler PROJETO-E-WORKPACKAGES e ROADMAP.","Selecionar apenas uma unidade para planejar.","Vincular metas e gates ao escopo aprovado.","Registrar mudanças após execução."],
 "Planejamento editorial; contratos permanecem nos owners.","Não aplicável.","Não aplicável.","Dependências e gates de plataforma devem constar do planejamento.","Critérios de aceite e impacto cruzado em cada incremento.","Projeto não é sinônimo de entrega.","Roadmap pode estar em revisão e depender de aprovações.",[BP("PROJETO-E-WORKPACKAGES.md"),BP("ROADMAP.md"),BP("PLANO-ATUALIZACAO-MODULOS.md")]),
 action("blueprint-environments","Conferir ambientes e operação declarados","ambientes","Localizar a topologia e identificar o que foi ou não implantado.",
 ["Consultar AMBIENTES e a documentação por servidor.","Conferir versões, owners e procedimentos diretamente na infraestrutura.","Não inferir readiness por documentação ou container Up."],
 "Referências de infraestrutura, não API executável.","Topologia real depende de Control, tenant DB e serviços configurados.","Sem API do Blueprint.","Endereços privados, segredos e credenciais não devem ser copiados ao leitor.","Requer healthchecks, grants, restore e evidência por ambiente.","Esta página não altera produção nem servidores.","Inventário de runtime precisa de reconciliação por ambiente.",[BP("AMBIENTES.md"),BP("MAPA-TECNICO-POR-CAMADAS.md"),doc("subprojects/I01-devserver01","STATUS.md")])
 ],
 sources:[BP("README.md"),BP("CATALOGO-MODULOS.md"),BP("MAPA-TECNICO-POR-CAMADAS.md"),BP("ROADMAP.md")],
 diagram:{nodes:["Visão / PRDs","Catálogo e owners","Core Platform","CRM / WhatsApp / Inbox","Security e Control","Infra e ambientes"],edges:[[0,1],[1,2],[2,3],[2,4],[3,5],[4,5]]}
 },
 {
 slug:"whatsapp",code:"P03",title:"WhatsApp",subtitle:"Conexão, mensagens, eventos e integração",state:"Código e testes locais · homologação pendente",
 intro:"O módulo WhatsApp possui package TypeScript, gateway Go/Whatsmeow, contratos de contas, entrada e saída de mensagens, outbox, eventos e migrations 001–008. O escopo atual prioriza texto e mantém a habilitação operacional sujeita a gates.",
 ownership:"P03 possui as regras de WhatsApp, o gateway I09 é componente da frente. CRM é dono do contato canônico; Inbox é dono da conversa e atendimento. Core Host/Control/Security mantêm seus próprios contratos.",
 groups:[
 {id:"contas",title:"Contas",description:"Identidade de contas e sessões de conexão."},
 {id:"mensagens",title:"Mensagens",description:"Entrada, saída e tratamento de texto."},
 {id:"integracoes",title:"Integrações",description:"Inbox, CRM e Event Bus."},
 {id:"seguranca",title:"Validações",description:"Escopos, canais e permissões."},
 {id:"operacao",title:"Operação",description:"Gateway, migrations, cutover e gates."}
 ],
 actions:[
 action("wa-accounts","Gerenciar contas e identidade de canal","contas","Preservar contexto de conta WhatsApp e suas referências autorizadas.",
 ["Resolver tenant/organização/workspace.","Consultar o contrato de contas.","Conectar recursos somente por gateway autorizado."],
 "modules/whatsapp/src/accounts.ts e contratos do pacote.","Migrations WhatsApp no Tenant DB; não no banco CRM.","Entradas do módulo e plugin; rotas requerem inspeção do controller específico.","FGA e entitlement de conta são gates separados.","Testar escopo, permissões e identidade externa.","Session store do gateway é distinto dos dados de negócio.","Onboarding de contas reais, quotas e grants ainda exigem verificação.",[WA.tech,code("modules/whatsapp/src/accounts.ts"),WA.status]),
 action("wa-gateway","Operar gateway Go / Whatsmeow","contas","Separar sessões/transportes do gateway da API de negócio TypeScript.",
 ["Gateway Go processa comunicação de sessão.","Callbacks chegam por caminho autenticado.","Backend trata contratos e persistência de negócio."],
 "I09 componente Whatsmeow + contrato interno P03.","Sessões do sidecar não são o Tenant DB de negócio.","API do sidecar não é pública para internet.","Autenticação interna, redes privadas e callbacks protegidos.","Testes Go não foram reexecutados na auditoria de 12/11.","Não executar conexão ou restart somente por documentação.","Persistência/quotas/gateway em runtime precisam de homologação.",[WA.operation,code("modules/whatsapp/gateway/whatsmeow/README.md"),WA.status]),
 action("wa-inbound","Receber e reconciliar mensagens de entrada","mensagens","Processar inbound de texto com origem, idempotência e escopo.",
 ["Receber evento do gateway.","Validar contexto e chave de mensagem.","Persistir ou publicar conforme os contratos e o estado do projetor."],
 "Inbound e contratos P03; Event Bridge C06.","Estruturas SQL próprias WhatsApp e inbox de domínio.","Não presumir rota externa sem verificar controller.","Não confiar em telefone, tenant ou evento sem validação.","Testar repetição, ordem, falhas e isolamento.","Projeção única exige cutover controlado.","Projetores concorrentes e rollout WA-CUT bloqueados.",[WA.tech,code("modules/whatsapp/src/event-bridge.ts"),WA.status]),
 action("wa-outbox","Despachar mensagens de texto pela outbox","mensagens","Controlar saída e retries mantendo registros idempotentes.",
 ["Comando autorizado solicita envio.","Outbox guarda intenção e estado da entrega.","Dispatcher/gateway envia e atualiza resultado conforme implementação."],
 "src/outbox.ts, contratos de envio e estado.","Outbox de WhatsApp e transactional event outbox são mecanismos distintos.","Consultar contratos e controller antes de afirmar endpoint.","Grants de envio, tenant, conta e serviço são pré-requisitos.","Testar duplicidade, retry, recuperação e failure modes.","Nenhum worker ativado por esta documentação.","Mídia e multi-projetor fora da fatia de aceite atual.",[WA.tech,code("modules/whatsapp/src/outbox.ts"),WA.status]),
 action("wa-crm-inbox","Relacionar WhatsApp, CRM e Inbox","integracoes","Reconciliar identidade externa com Person canônica e contexto de conversa.",
 ["Registrar participante observado na Inbox.","Política do CRM resolve identidade quando inequívoca.","Publicar resolução ou revisão; consumidor interessado processa sob contrato."],
 "inbox.participant.observed.v1 → crm.person.resolved.v1 / review_required.v1; CRM-WA-01 é dry-run.","CRM Person é canônica; WhatsApp guarda identidade externa de canal.","Integração preferencialmente por eventos versionados.","Nome pushname não sobrescreve pessoa confirmada; ambiguidade exige revisão.","Testar retry, idempotência e matching por tenant/organização.","Revisão humana e vínculo transacional ainda não homologados.","Não criar pessoa automaticamente ou alterar SQL real sem aprovação.",[WA.status,code("modules/whatsapp/src/crm-link-plan.ts"),code("modules/core-crm/src/whatsapp-identity-events.ts")]),
 action("wa-cutover","Homologar projetor e migrações de WhatsApp","operacao","Planejar rollout da migration 008 e garantir ausência de projetores concorrentes.",
 ["Auditar versões, grants e backup.","Revalidar migration 008 em ambiente descartável/staging.","Canário com observabilidade e rollback.","Registrar evidência por SHA e ambiente."],
 "WA-CUT07–10: gates, não capability de produto concluída.","SQL 001–008; migration 008 é sensível ao owner do projetor.","Não aplicável ao fluxo de documentação.","Control ENABLED, service grants FGA e restore são pré-requisitos.","Testes de gateway/PG17/integração em ambiente adequado.","Proibida habilitação operacional por simples publicação documental.","Cutover e restauração não comprovados.",[WA.status,WA.operation,code("modules/whatsapp/sql/008_whatsapp_projection_owner.sql"),WA.plan])
 ],
 sources:[WA.scope,WA.status,WA.tech,WA.operation,WA.plan],
 diagram:{nodes:["Whatsmeow Go I09","WhatsApp P03","Outbox / inbound","Event Bus C06","Inbox P02","CRM P01"],edges:[[0,1],[1,2],[2,3],[3,4],[4,5]]}
 },
 {
 slug:"security",code:"C03 / C04 / C05",title:"Security",subtitle:"Identity, autorização e gestão de segredos",state:"Auditorias parciais · Product Gate aberto",
 intro:"Security é uma área de leitura que reúne três owners independentes: Keycloak (C03) autentica usuários, OpenFGA (C04) decide permissões e OpenBao (C05) entrega segredos. Um token válido não concede automaticamente acesso à plataforma.",
 ownership:"C03 mantém contratos OIDC; C04 mantém o modelo de autorização; C05 mantém a infraestrutura de segredos. O Core Host e outros consumidores são proprietários dos próprios adapters.",
 groups:[
 {id:"identity",title:"Identity · Keycloak",description:"Login, OIDC, PKCE e verificação JWT."},
 {id:"authorization",title:"Authorization · OpenFGA",description:"Permissões de usuários e serviços, com escopos."},
 {id:"secrets",title:"Secrets · OpenBao",description:"Entrega de configuração sensível e políticas."},
 {id:"validacoes",title:"Validações",description:"Segurança transversal, testes e recuperação."}
 ],
 actions:[
 action("security-login","Autenticar usuários com Keycloak","identity","Manter login OIDC separado por frontend e contexto, sem confundir identidade com autorização.",
 ["Frontend inicia Authorization Code + PKCE S256.","Keycloak emite tokens sob issuer e client corretos.","Backend verifica JWT com JWKS e valida issuer/audience/azp."],
 "C03: OpenID Connect; consumidores A01/A02/A04/A05/A06 possuem os adapters.","Banco técnico syndes_keycloak é separado de Control e tenant DB.","Endpoints OIDC do provedor; não são APIs comerciais do Syndes.","State, PKCE, callback e issuer HTTPS devem ser validados.","Testes de JWT/JWKS existem; browser com IAM/tenants reais não foi homologado.","Configuração de realm ativa não comprovada apenas por Compose.","Acesso global Manager e Workspace devem permanecer separados.",[KC.tech,KC.status,code("apps/workspace-web/src/lib/auth.ts"),code("infra/security-access/compose.yaml")]),
 action("security-jwt","Validar JWT e separar clients","identity","Garantir que identidade de outro client não abra acesso ao Host ou Manager.",
 ["Verificar assinatura RS256/JWKS.","Validar iss, aud, azp e sub.","Checar acesso ao contexto no serviço destino."],
 "ActorVerifier no Core Host; verificadores no Manager/Account API.","Não gera tabelas de produto.","Contratos de JWT dos consumers; não equivalem à autorização do recurso.","Sem fallback permissivo; tokens Master não são aceitos indiscriminadamente.","Negativas de audience/azp e tokens inválidos; E2E real pendente.","Não publicar tokens, JWKS privados ou secrets.","Política efetiva de clients/redirects precisa de auditoria com permissão.",[KC.tech,KC.status,code("apps/core-host/src/adapters.ts")]),
 action("security-fga-user","Autorizar recurso por OpenFGA","authorization","Distinguir membership tenant, capacidade de módulo e autorização de recurso.",
 ["Identidade é verificada por Keycloak/Host.","Contexto tenant/organização/workspace é resolvido.","Adapter pergunta ao OpenFGA store/check.","Recurso é negado se check ou gate falhar."],
 "C04 fga-model.json: tenant, resource, viewer/editor, can_read/can_write.","Store do OpenFGA é técnico; Control mantém memberships e estados do módulo.","POST /stores/{store}/check é API do serviço OpenFGA, consumida pelo Host.","Decisão fail-closed; token válido não basta.","Testar tenant A/B, ausências de tuple e proibições.","Modelo no Git não prova model ID/tuples atuais.","Grants reais e store de produção não verificados.",[FGA.tech,FGA.status,code("infra/security-access/fga-model.json"),code("apps/core-host/src/adapters.ts")]),
 action("security-fga-service","Autorizar consumidores e workers por serviço","authorization","Separar identidade/grants de serviços da autorização de operadores humanos.",
 ["Worker apresenta identidade trusted de serviço.","Verificar event_delivery, escopo e can_process.","Confirmar ENABLED e controles do tenant antes de processar."],
 "OpenFgaServiceEventGrant / TenantEventWorkerAdmission.","Sem ownership de dados CRM/WhatsApp por C04.","OpenFGA check para service principal e event_delivery.","Service principal não pode usar permissões humanas por conveniência.","Testar negações, replay, tenants A/B, suspensão e escopos.","Consumer opt-in não indica worker em execução.","Modelo e grants efetivos de eventos podem diferir do repo.",[FGA.tech,FGA.status,code("apps/core-host/src/platform-event-service-grant.ts"),code("apps/core-host/src/platform-event-worker-admission.ts")]),
 action("security-openbao","Distribuir segredos via OpenBao","secrets","Entregar runtime sensível com AppRole, KV e controles de acesso por serviço.",
 ["Renderer autentica via AppRole autorizado.","Lê entradas KV específicas do serviço.","Escreve arquivo runtime de modo atômico em destino protegido.","Revoga token bootstrap quando aplicável."],
 "C05: render_runtime.py; A04: loadCoreSecrets; policies/*.hcl.","OpenBao usa Raft do serviço; não é banco de tenant.","API OpenBao AppRole/KV/revoke-self; não expor credenciais em documentação.","TLS, policy mínima e arquivos protegidos; falha de segredo não autoriza fallback inseguro.","Smoke descartável e mocks não provam cofre em produção.","Não consultar KV real, unseal ou rotacionar por documentação.","Unseal, backups Raft, grants, rotação e recovery pendentes.",[BAO.tech,BAO.status,code("infra/security-access/openbao/render_runtime.py"),code("apps/core-host/src/secrets.ts")]),
 action("security-gates","Validar cadeia completa de segurança","validacoes","Homologar autenticação, autorização, segredos e isolamento como controles independentes.",
 ["Conferir estado de Keycloak, FGA e Bao por ambiente.","Validar fluxo positivo e negativo de identidade.","Verificar memberships, grants, tenant A/B e segredos.","Executar testes de recuperação e registrar evidências."],
 "Owner individual por serviço; Security é agrupador editorial.","Cada serviço tem persistência técnica própria e APIs próprias.","Não existe um endpoint Security unificado aprovado.","Não declarar segurança operacional baseada apenas em containers Up.","Sem E2E de acesso real e DR formal nos checkpoints consultados.","Exige sign-off de owners e procedimento de rollback.","Product Gate aberto em C03, C04 e C05.",[KC.status,FGA.status,BAO.status,KC.operation,FGA.operation,BAO.operation])
 ],
 sources:[KC.status,FGA.status,BAO.status,KC.tech,FGA.tech,BAO.tech],
 diagram:{nodes:["Workspace / Manager","Keycloak C03","Core Host A04","OpenFGA C04","OpenBao C05","Control / Tenant DB"],edges:[[0,1],[1,2],[2,3],[4,2],[3,5],[2,5]]}
 }
];
export const pilotModuleBySlug=(slug)=>PILOT_MODULES.find(m=>m.slug===slug);
export const PILOT_NAV=[{slug:"crm",title:"CRM",code:"P01",subtitle:"Relacionamento e cadastro"},...PILOT_MODULES.map(({slug,title,code,subtitle})=>({slug,title,code,subtitle}))];
