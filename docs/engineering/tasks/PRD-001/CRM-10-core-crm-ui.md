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
- Permitidos: `apps/web/src/modules/core-crm/**`, rotas de composição CRM e testes desse módulo.
- Proibidos: `apps/api/**`, `platform-admin/**`, shared business rules, módulos futuros.

## Aceite e evidência

- Jornada coberta por component/API tests; inputs mostram erros do backend; autorização real é mantida no servidor.
- Nenhuma troca de tenant controlada por input client-side.
- E2E Playwright headless é opt-in; não executá-lo automaticamente nem usar navegação GUI. Se autorizado, gerar e analisar log de cada etapa.
- Próximo owner: Codex review; depois CRM-11.
