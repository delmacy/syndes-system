# CRM-10 — Frontend Core CRM

- **Módulo/gate:** Core CRM integrated modules / Sprint 3.
- **Classificação:** MVP.
- **Prioridade/estado:** P1 / depende de CRM-00 e CRM-05 a CRM-08.
- **Responsável recomendado:** Cursor Auto, fatias exclusivas; Codex revisa.
- **Issue/branch/commit/PR:** ainda não criados; esta é uma ordem local, sem operação externa.

## Objetivo e escopo

Criar telas Next.js App Router do módulo `core-crm` para a jornada aprovada, consumindo APIs NestJS.

## Incluído

- Organization/Person lists, details, create/edit/archive e relacionamentos.
- Tags, notes, timeline, search, duplicate warning, channel identity metadata.
- CSV import/export com feedback de validação/permissão.
- All attendants use this same CRM application. Include an admin-only team settings view to manage Employee profiles and each member's fixed `cpf`/`pj`/`both` scope; do not create a separate employee portal.
- Show and search only records allowed by the assigned scope; backend filtering remains authoritative.
- Estado carregando/vazio/erro/sucesso e acessibilidade básica; regras de domínio permanecem no backend.
- Component tests na mesma fatia de cada tela/behavior; manter teste de integração de API contratual quando apropriado.
- Criar script Playwright headless da jornada de aceite que produza logs/resultados estruturados por etapa; manter invocação opt-in e não executar como parte desta ordem sem autorização/gate explícito.

## Excluído

- Platform Admin (CRM-09), regras de tenant/auth no client, pipeline/deals/IA/custom fields, duplicar endpoints/dados no Next route handlers.

## Dependências/ownership

- Depende de API/session contracts CRM-00, identidade/tenancy CRM-03 e APIs CRM-05–08.
- Permitidos: `apps/web/src/modules/core-crm/**`, rotas de composição CRM e testes desse módulo. Um bloqueio do MVP foi fechado com API mínima no Core CRM: contexto role/scope, consulta/atualização de memberships do tenant-admin e lista de relações visíveis por Person. Essas rotas não recebem tenant ID do cliente e mantêm autorização no servidor.
- Proibidos: `platform-admin/**`, shared business rules, módulos futuros e qualquer outro endpoint fora das dependências diretas dessas telas.

## Aceite e evidência

- Jornada coberta por component/API tests; inputs mostram erros do backend; autorização real é mantida no servidor.
- Nenhuma troca de tenant controlada por input client-side.
- E2E Playwright headless é opt-in; não executá-lo automaticamente nem usar navegação GUI. Se autorizado, gerar e analisar log de cada etapa.
- Próximo owner: Codex review; depois CRM-11.

## Plano complementar de completude do frontend (solicitado em 2026-10-28)

O CRM-10 já foi implementado e aceito no gate original. Esta revisão fecha lacunas de uso observadas na demonstração e no ambiente de teste persistente, mantendo o trabalho dentro de `apps/web/src/modules/core-crm/**` e dos contratos mínimos do Core CRM. Não inicia outro módulo funcional.

### Casos de uso a cobrir

1. Atendente `cpf`, `pj` ou `both` encontra apenas os registros que o backend autoriza; estado sem resultados é distinto de tela ainda não pesquisada.
2. Pessoa/organização pode ser criada, aberta, editada, relacionada, anotada, marcada e arquivada com confirmação antes da ação destrutiva.
3. Tags existentes podem ser vinculadas ao cadastro; tags efetivamente vinculadas são distintas do catálogo de tags do tenant e podem ser removidas. Criação de nome duplicado explica como reutilizar a tag existente.
4. Notas e alterações de tag atualizam a tela de detalhes e a timeline sem exigir reabrir o cadastro.
5. Identidade externa mostra estado vazio/erro, permite vincular metadados e mantém claro que push name não altera o nome CRM.
6. Administração de equipe permite incluir/desativar perfis e configurar escopo de membro ativo; membros não veem controles de equipe, arquivamento ou exportação.
7. Importação CSV diferencia arquivo ausente, arquivo inválido, limite excedido, validação rejeitada e sucesso; exportação respeita o papel e informa falha recuperável.

### Edge cases comuns

- Carregamento, lista vazia, busca vazia, erro de rede/servidor, sessão expirada, conflito de nome de tag, associação já existente e cadastro fora do escopo.
- Evitar repetir mutações enquanto estão em andamento e ignorar respostas de detalhes que cheguem fora de ordem após trocar rapidamente de registro.
- Seleção de arquivo limpa o resultado anterior; falhas mantêm os dados necessários para uma nova tentativa.
- Arquivar exige confirmação explícita e continua disponível somente para `tenant_admin`.
- Strings e dados devolvidos pelo backend são renderizados como texto; mensagens nunca expõem tokens, stack traces ou detalhes internos.

### Sequência e gate

1. Corrigir e provar a listagem de tags atribuídas por cadastro, com o mesmo TenantContext e customer scope usados nas mutações.
2. Completar o fluxo de tags existentes/criadas/removidas e atualizar detalhes/timeline após mutações.
3. Completar estados de busca, formulários, arquivo e confirmação de arquivamento; não mover regras de domínio ou autorização para o navegador.
4. Adicionar testes de componente e integração API para cada comportamento alterado; rodar lint, typecheck, suites relevantes e build.
5. Manter Playwright como aceite opt-in; ao executá-lo, usar dados exclusivos por execução e analisar o log estruturado, sem usar estado visual manual como prova.

### Fora deste complemento

Dashboard analítico, pipeline/deals, custom fields, automações, IA, integrações de canais além dos metadados já aprovados, novos papéis, troca de tenant pelo usuário e mudanças de identidade/autorização.

### Evidência e decisão

- Implementado no commit `4619466` (`feat(core-crm): complete CRM frontend flows`). O frontend diferencia catálogo de tags de tags vinculadas, permite reutilizar/remover tags, atualiza notas/timeline após mudanças, limpa estados ao trocar cadastro, descarta respostas fora de ordem, distingue busca vazia/erro e exige confirmação para arquivar.
- Web local: lint, typecheck, Vitest (8 arquivos/20 testes) e build passaram; o build usou apenas valores fictícios de configuração OIDC exigidos no build-time.
- API local: lint, typecheck, Jest unitário (32 suites/180 testes) e build passaram. A integração PostgreSQL foi executada no CI por ausência de Docker no ambiente local.
- CI no commit `4619466`: [API 40682270856](https://github.com/delmacy/syndes-system/actions/runs/40682270856), [Repository Integrity 40682270809](https://github.com/delmacy/syndes-system/actions/runs/40682270809) e [CRM Acceptance 40682270644](https://github.com/delmacy/syndes-system/actions/runs/40682270644) passaram. API incluiu PostgreSQL 16 descartável; Web incluiu lint, typecheck, 20 testes, build e audit.
- Playwright artifact revisado: `expected=1`, `skipped=0`, `unexpected=0`, `flaky=0`; as seis etapas (`login_and_tenant_context`, `create_organization`, `create_person_and_relationship`, `tag_and_note`, `search_and_timeline`, `archive_and_csv_export`) passaram. A fixture da tag agora usa nome exclusivo por execução e a jornada confirma sucesso antes de continuar.
- **Decisão: ACEITO para esta complementação de CRM-10.** O módulo Core CRM não reabre o Product Gate nem autoriza avanço de outro módulo.
