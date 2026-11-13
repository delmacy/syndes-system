import { extraCrmOperations } from "./crm-expanded-operations.js";
/**
 * CRM operations are reader-sized entry points. Evidence is source-backed,
 * never proof of rollout. Related technical topics remain in crmSections.
 */
const ROOT="https://github.com/delmacy/syndes-system/blob/main/";
const source=(label,path)=>({label,url:ROOT+path});
const service=source("Serviço CRM","modules/core-crm/src/service.ts");
const controller=source("Controller HTTP","modules/core-crm/src/crm.controller.ts");
const contracts=source("Tipos e contratos","modules/core-crm/src/contracts.ts");
const validation=source("Validação","modules/core-crm/src/validation.ts");
const sql1=source("Migration SQL 001","modules/core-crm/sql/001_crm_foundation.sql");
const sql2=source("Migration SQL 002","modules/core-crm/sql/002_crm_tags_notes.sql");
const status=source("Estado e gates CRM","docs/subprojects/P01-crm/STATUS.md");
const extras=source("Operações adicionais","modules/core-crm/src/extra.ts");
const crmOperationsBase=[
  {
    id:"crm-create-person",group:"cadastros",title:"Criar contato",kind:"Cadastro",state:"Código identificado · homologação pendente",
    objective:"Registrar uma pessoa dentro do contexto autorizado de um tenant para iniciar ou preservar o relacionamento.",
    behavior:["O host autentica o ator e resolve o contexto confiável do tenant.","CrmService.createPerson normaliza nome, email e telefone e solicita crm:people/write ao Core Kernel.","Após autorização, o repositório selecionado por tenant grava uma pessoa com identificador UUID."],
    inputs:[["name","Obrigatório, texto normalizado de 1 a 160 caracteres"],["email","Opcional, até 254 caracteres; normalizado para minúsculas"],["phone","Opcional, 10 a 15 dígitos; representado como + seguido dos dígitos"]],
    output:"Person: id, tenantId, name, email, phone e archivedAt. A resposta depende do contrato real no host.",
    rules:["Não confiar em tenantId ou actorId provenientes do formulário.","scopeWriteAllowed=false nega escrita; modo multi-org exige organizationId quando habilitado.","O banco do tenant contém crm_people e registros de auditoria em crm_audit.","O controller traduz validações para HTTP 400, proibição para 403, conflito de banco para 409 e indisponibilidade para 503."],
    contract:{method:"CrmService.createPerson(context, input: CreatePerson)",http:"POST /v1/tenants/:tenantId/crm/people",permission:"crm:people · write",data:"crm_people, crm_audit"},
    evidence:"O método, os tipos, o controller, validações e migrations estão presentes no repositório. A jornada autenticada real não consta como homologada.",
    acceptance:["Nome inválido, vazio ou acima do limite é rejeitado.","Operador sem crm:people/write não cria registro.","Dados de tenant A não aparecem em tenant B.","Criar e consultar o contato é comprovado com JWT/FGA e PostgreSQL reais.","Registrar SHA, ambiente, logs e resultado de aceite."],
    task:"Validar a operação de criação de pessoa ponta a ponta, sem alterar o modelo multi-tenant nem habilitar migrations. Documentar respostas HTTP e evidência de isolamento.",sources:[service,contracts,controller,validation,sql1,status]
  },
  {
    id:"crm-search-person",group:"cadastros",title:"Consultar e pesquisar contatos",kind:"Consulta",state:"Código identificado · homologação pendente",
    objective:"Localizar pessoas cadastradas preservando escopo de tenant e paginação segura.",
    behavior:["O controller recebe q, limit e offset e resolve contexto autorizado.","CrmService.listPeople valida paginação e normaliza o termo de busca.","O repositório do tenant retorna registros para consulta; getPerson busca uma pessoa por UUID."],
    inputs:[["q","Termo opcional de até 100 caracteres; caracteres SQL especiais escapados"],["limit","Inteiro entre 1 e 100; padrão 25"],["offset","Inteiro entre 0 e 100000; padrão 0"]],
    output:"Lista de Person ou Person|null para consulta por ID; no controller, pessoa inexistente retorna HTTP 404.",
    rules:["Leitura requer crm:people/read.","Tenant é resolvido pelo host autenticado.","ID deve ser UUID válido."],
    contract:{method:"CrmService.listPeople / getPerson",http:"GET /v1/tenants/:tenantId/crm/people · GET /people/:id",permission:"crm:people · read",data:"crm_people"},
    evidence:"Serviços e endpoints declarados; falta demonstração de jornada real completa.",
    acceptance:["Rejeitar paginação fora dos limites.","Comprovar busca e leitura A/B sem vazamento entre tenants.","Verificar 401, 403 e 404 no host real."],
    task:"Testar listagem e busca de pessoa com autenticação real, filtros e isolamento, preservando o contrato do serviço.",sources:[service,controller,validation,sql1,status]
  },
  {
    id:"crm-create-organization",group:"cadastros",title:"Cadastrar organização comercial",kind:"Cadastro",state:"Código identificado · homologação pendente",
    objective:"Registrar a empresa relacionada a contatos; não criar uma organização administrativa de plataforma.",
    behavior:["O serviço normaliza os dados comerciais.","Autoriza crm:organizations/write no Core Kernel.","Grava crm_organizations na base do tenant."],
    inputs:[["legalName","Obrigatório, de 1 a 160 caracteres"],["tradeName","Opcional, até 160 caracteres"],["taxId","Opcional, CPF com 11 ou CNPJ com 14 dígitos após normalização"]],
    output:"Organization com id, tenantId, legalName, tradeName, taxId e archivedAt.",
    rules:["Organização de CRM não é Platform Organization nem tenant.","É necessária autorização de escrita e isolamento por tenant."],
    contract:{method:"CrmService.createOrganization",http:"POST /v1/tenants/:tenantId/crm/organizations",permission:"crm:organizations · write",data:"crm_organizations"},
    evidence:"Código e schema presentes; ativação integrada requer comprovação.",
    acceptance:["Rejeitar nome e identificação inválidos.","Verificar que a operação não cria organização de plataforma.","Testar isolamento entre tenants."],
    task:"Homologar cadastro comercial com validações e fronteira explícita contra Control Plane.",sources:[service,contracts,controller,validation,sql1,status]
  },
  {
    id:"crm-link-organization",group:"cadastros",title:"Vincular pessoa e organização",kind:"Relacionamento",state:"Código identificado · homologação pendente",
    objective:"Associar uma pessoa a uma empresa de relacionamento já cadastrada.",
    behavior:["Recebe UUIDs de pessoa e organização.","CrmService.linkPerson solicita crm:relationships/write.","O repositório registra o vínculo no tenant."],
    inputs:[["personId","UUID válido da pessoa"],["organizationId","UUID válido da organização comercial"]],
    output:"PersonOrganization com tenantId, personId e organizationId.",
    rules:["Chaves estrangeiras compostas por tenant_id preservam a integridade.","Não realizar vínculo entre dados de tenants diferentes."],
    contract:{method:"CrmService.linkPerson",http:"POST /v1/tenants/:tenantId/crm/people/:id/organizations",permission:"crm:relationships · write",data:"crm_person_organizations"},
    evidence:"Método e migration presentes; vínculo com dados reais não foi homologado na auditoria.",
    acceptance:["Vincular dois registros do mesmo tenant.","Bloquear referência de outro tenant.","Comprovar restrição e tratamento de registros inexistentes."],
    task:"Testar vínculo comercial preservando isolamento por tenant e integridade referencial.",sources:[service,contracts,controller,sql1,status]
  },
  {
    id:"crm-create-note",group:"atendimento",title:"Registrar nota de atendimento",kind:"Atendimento",state:"Código identificado · homologação pendente",
    objective:"Preservar contexto escrito de uma interação para consultas posteriores.",
    behavior:["Seleciona a pessoa autorizada por UUID.","Normaliza quebras de linha, remove espaços nas extremidades e valida o corpo.","Solicita crm:notes/write e registra a nota com autor e data."],
    inputs:[["personId","UUID válido da pessoa"],["body","Texto obrigatório, 1 a 5000 caracteres após normalização"]],
    output:"Note com id, tenantId, personId, body, createdBy e createdAt.",
    rules:["Controles inválidos e notas vazias são rejeitados.","A nota pertence à pessoa e ao tenant informado pelo host autenticado.","Registrar nota não significa automaticamente publicar evento ou enviar mensagem WhatsApp."],
    contract:{method:"CrmService.createNote",http:"POST /v1/tenants/:tenantId/crm/people/:id/notes",permission:"crm:notes · write",data:"crm_notes"},
    evidence:"Código e migration SQL 002 presentes; fluxo integrado de atendimento permanece aberto.",
    acceptance:["Registrar e consultar nota com autor correto.","Rejeitar texto vazio ou superior ao limite.","Bloquear acesso cruzado entre tenants.","Executar com identidade e autorização reais."],
    task:"Validar notas e histórico dentro da jornada autenticada CRM/Workspace, sem acoplar diretamente ao Inbox.",sources:[service,contracts,controller,sql2,status]
  },
  {
    id:"crm-read-timeline",group:"atendimento",title:"Consultar histórico e timeline",kind:"Atendimento",state:"Código identificado · homologação pendente",
    objective:"Permitir leitura cronológica das ações de relacionamento já registradas.",
    behavior:["Resolve pessoa e escopo autorizado.","listTimeline retorna ações auditadas; listNotes consulta anotações.","O leitor visualiza contexto sem alterar registros."],
    inputs:[["personId","UUID válido da pessoa"],["limit","Inteiro entre 1 e 100; padrão 50"]],
    output:"TimelineEntry[] ou Note[], com datas e referências de autor conforme os contratos.",
    rules:["crm:people/read para timeline; crm:notes/read para notas.","Não tratar timeline como prova de integração WhatsApp concluída."],
    contract:{method:"CrmService.listTimeline / listNotes",http:"GET /people/:id/timeline · GET /people/:id/notes",permission:"crm:people/read · crm:notes/read",data:"crm_audit, crm_notes"},
    evidence:"Métodos declarados e tabelas existentes; apresentação de ponta a ponta a homologar.",
    acceptance:["Confirmar ordenação e paginação.","Comprovar restrição de acesso e tenant.","Distinguir notas de eventos de outros módulos."],
    task:"Comprovar timeline de pessoa e notas na experiência real do Workspace, sem inventar histórico de canais.",sources:[service,contracts,controller,sql1,sql2,status]
  },
  {
    id:"crm-authorization",group:"validacoes",title:"Validar autorização e isolamento",kind:"Controle",state:"Guardas identificadas · E2E pendente",
    objective:"Proibir operações fora do tenant, organização ou permissão autorizados.",
    behavior:["O host valida bearer e resolve actor/tenant.","CoreKernel.execute avalia recurso e ação antes do repositório.","O contexto pode negar escrita e exigir organização quando multi-org está habilitado."],
    inputs:[["actor e tenantId","Contexto confiável produzido pelo host"],["resource/action","Recurso crm:* e operação read/write"]],
    output:"Autorização ou erro HTTP; não retorna dados de outro escopo.",
    rules:["401 identifica autenticação ausente ou inválida.","403 representa proibição; 503 falha de infraestrutura, sem autorizar por erro.","Não ativar multi-org sem gates e testes reais."],
    contract:{method:"CrmService.execute / CrmHost.run",http:"Todas as rotas CRM",permission:"CoreKernel e recursos crm:*",data:"Banco de tenant confiável"},
    evidence:"Guardas existem, mas STATUS mantém WBS 50.02 e Product Gate abertos.",
    acceptance:["JWT inválido: 401.","Operador sem recurso: 403.","Tenant A/B isolados.","Infra indisponível: 503 sem fail-open."],
    task:"Executar matriz real de IAM e tenant A/B sem alterar gates ou habilitar multi-org.",sources:[service,controller,status]
  },
  {
    id:"crm-public-contracts",group:"integracoes",title:"Consultar contrato público do CRM",kind:"Contrato",state:"Declaração de código · exposição a validar",
    objective:"Distinguir tipos exportados, métodos de serviço e endpoints declarados no host.",
    behavior:["O pacote define contratos TypeScript.","O plugin integra o domínio ao host NestJS.","O controller declara as rotas /v1/tenants/:tenantId/crm."],
    inputs:[["CrmContext","actor, tenantId e escopo opcional"],["CreatePerson","name, email? e phone?"]],
    output:"Contratos para integração — não constituem garantia de endpoint implantado.",
    rules:["Não confundir método interno com API pública homologada.","O controller não deve aceitar actor e tenant do corpo como autoridade."],
    contract:{method:"CrmService + CrmRepository",http:"/v1/tenants/:tenantId/crm",permission:"crm:people, crm:organizations, crm:notes etc.",data:"Banco PostgreSQL do tenant"},
    evidence:"Manifesto, tipos e controller verificados; gate real pendente.",
    acceptance:["Verificar exports e versões.","Comprovar rotas com host autenticado.","Documentar códigos de resposta a partir de testes, não apenas decorators."],
    task:"Auditar exports e contrato HTTP com testes reais sem divulgar funções internas como API estável.",sources:[contracts,controller,service,status]
  },
  {
    id:"crm-product-gate",group:"evolucao",title:"Homologar jornada CRM",kind:"Planejamento",state:"Pendente · não aprovado",
    objective:"Converter implementação local em uma jornada integrada verificável, sem ampliar escopo automaticamente.",
    behavior:["Reconciliar escopo e SHA do módulo.","Validar JWT, FGA, banco real, interface e isolamento.","Registrar testes positivos/negativos, restore e aceite."],
    inputs:[["WBS 50.02","Autorização e CRM E2E"],["WBS 50.08","Aceite CRM + Inbox + WhatsApp Basic"]],
    output:"Relatório de homologação e decisão de Product Gate; ainda não existente.",
    rules:["29 testes locais da auditoria não equivalem a homologação do produto.","Não aplicar migrations ou habilitar worker sem autorização e preflight."],
    contract:{method:"Gate de validação, não API de negócio",http:"Não aplicável",permission:"Revisão e aceite",data:"Evidência por SHA/ambiente"},
    evidence:"STATUS 12/11/2026 registra bloqueios e ausência de aceite.",
    acceptance:["Comprovar tenant A/B e negativas 401/403.","Validar navegação E2E.","Registrar rollback e restaurabilidade.","Aprovar ou rejeitar Product Gate."],
    task:"Produzir matriz de evidências para fechamento do CRM MVP, sem executar migrations ou habilitar funcionalidades.",sources:[status,source("Evolução do CRM","docs/subprojects/P01-crm/EVOLUCAO.md")]
  }
];
export const crmOperations=[...crmOperationsBase,...extraCrmOperations];
export const operationById=(id)=>crmOperations.find(op=>op.id===id);
export const operationsByGroup=(groupId)=>crmOperations.filter(op=>op.group===groupId);
export const crmOperationIds=crmOperations.map(op=>op.id);
