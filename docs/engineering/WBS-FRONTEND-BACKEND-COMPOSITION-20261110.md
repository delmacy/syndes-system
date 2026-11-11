# WBS — Consolidação Account / Organization / Workspace e composição de módulos

**Baseline observado:** main f537b2bfac542dbe4121631cc6f9ff03fcf96daa em 2026-11-10.
**Decisão:** ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md.
**Escopo:** orquestrar a implementação existente, sem novas features de produto, sem reescrever CI e sem migrações operacionais.
**Estado atual:** decisões/documentação, tarefas de execução ainda pendentes ou parcialmente codificadas.

### Dependências e ordem preferencial

  P0-F0 inventário e contratos → P0-F1 refatorar shell/registro mantendo UI
           ↓                                 ↓
  P0-F2 gate ModuleAccess em TODOS os handlers/workers → P1-F3 Account e contexto
           ↓                                 ↓
  P0-F4 backups, staging e Manager separado → P1-F5 E2E de tenant/Manager
           ↓
  Retomar MVP CRM → Inbox → WhatsApp → Scheduling etc. pela ordem já aprovada

A F1 (UI estrutural) pode avançar em paralelo à F2 (backend), mas uma navegação comercial condicionada a módulos ENABLED **não pode ser liberada** antes do gate real e do read model autenticado. A conta operacional Syndes e Support são fluxos da WBS mestre, não novas apps frontend.

| ID | Prioridade | Entrega com fronteira clara | Critério verificável de aceite | Dependências | Status |
| --- | --- | --- | --- | --- | --- |
| FC-00.01 | P0 | Baseline source/deploy/PR: comparar apps/workspace-web, apps/master-admin-web, front-shared, Nest plugins, org legacy e Account Access | SHA, Docker release, worktree/branch e consumidores legados inventariados; nenhuma alteração em checkout sujo | — | PEND |
| FC-00.02 | P0 | Congelar contratos frontend e nomenclatura Account, Platform Organization, CRM Organization, Workspace, Unit, Team | ADR aprovada; UI não confunde empresa da conta com contato empresarial no CRM; não duplicar entidade | FC-00.01 | PEND |
| FC-01.01 | P0 | Extrair layout e navegação genéricos do monólito apps/workspace-web/src/App.tsx para app shell/components | Mesma aparência e operações atuais: Inbox, CRM, Settings, Overview; todos os testes anteriores preservados | FC-00.02 | CODIFICADO; TESTES LOCAIS PASS, CI PEND |
| FC-01.02 | P0 | Extrair seleção de contexto autenticado Organization/Workspace e ciclo de vida scoped | Sem persistência entre logins; troca limpa SSE/estado/cache; refresh/logout não ressuscitam tenant anterior; requests in-flight abortados | FC-01.01 | CODIFICADO: GET/CSV/SSE/mutations abortáveis, replay tardio negado; 39 unit e browser A/B PASS; CI PEND |
| FC-01.03 | P0 | Registro tipado ESTÁTICO das features existentes e rotas, não runtime plugin marketplace | Componentes montados sem switch manual gigante; IDs/rotas únicos; erros e módulos desconhecidos fail-closed; 1 build React tenant | FC-01.01 | CODIFICADO; TESTES LOCAIS PASS, CI PEND |
| FC-01.04 | P0 | Preservar front-shared como design system único e duas aplicações isoladas | Testes source contract + builds manager/workspace; nenhum token/tenant/session/API no shared | FC-01.01 | PARCIAL (package integrado) |
| FC-02.01 | P0 | Inventariar CoreKernel.execute sem gate vs executeModule, endpoints Nest e workers/Go | Matriz rota→módulo→ator→tenant/org/workspace→FGA→ModuleAccess e caminhos de bypass, incluindo legado /crm | FC-00.01 | PEND |
| FC-02.02 | P0 | Migrar controllers e jobs existentes para validação obrigatória por operação, sem mudar contrato público indevidamente | Tenant A autorizado, B sem entitlement negado, suspenso/revogado deny; erro Control DB fail-closed; integração com SQL legado controlada | FC-02.01, AK-10.04, AK-30.03 | BLOQ (migração operacional pendente) |
| FC-02.03 | P0 | Contrato HTTP tenant-safe de funcionalidades disponíveis ao usuário, distinto do inventário Manager | Autenticação Workspace; devolve apenas módulos realmente operáveis e capabilities no escopo; fallback explícito indisponível, não inventa zeros | FC-02.02 | BLOQ |
| FC-01.05 | P1 | Integrar o registry frontend ao contrato de disponibilidade após provar gate backend | Feature ausente/denegada não aparece; URL direta também negada no backend; nenhuma flag de menu concede permissão | FC-01.03, FC-02.03 | BLOQ |
| FC-03.01 | P1 | Read API Account com identidade/role delegada e estados reais | Account Owner/Admin sem acesso implícito CRM/Inbox, worker negado, último Owner protegido; sem novo CRUD falso | WBS 30, FC-02.02 | BLOQ |
| FC-03.02 | P1 | Criar área Account mínima (dados reais da conta, acesso permitido), sem billing antecipado | Testes da matriz owner/admin/agent; nenhuma API do Manager/token cruzado, sem dados mock em build real | FC-03.01, FC-01.01 | BLOQ |
| FC-03.03 | P1 | Separar Organization administração do Workspace operacional; labels distintos de CRM Company | Membership/FGA por org; diretório e seleção autorizados; sem transformar CRM Organization em Platform Organization | FC-01.02, WBS 30 | BLOQ |
| FC-03.04 | P0 | Remover fallback tenant-only e permitir multi-org somente com backfill/roteamento protegido e Product Gate #31 | SQL 002 preservado até aprovação; inbound/outbound WhatsApp, SSE, CRUD/worker e cross-workspace negam acessos arbitrários | issue #21, #31, FC-02.02 | BLOQ |
| FC-04.01 | P0 | Backup/restore Control DB e tenant; versioned migrations com operator isolado | Restore real em DB separado; ledger SHA, grants, tenant mapping, rollback e logs sanitizados; no-op verificável | AK-30.04, WBS 10.07 | BLOQ |
| FC-04.02 | P1 | Manager real separado: Keycloak, AppRole/roles SQL mínimas, API e HTTPS próprio | Login real, módulos inventariados por Control DB; sem tenant DB; owner com sub aprovado; negação de token cross-app | FC-04.01, WBS 20.03–20.09 | BLOQ |
| FC-05.01 | P0 | Suíte E2E transversal: accounts A/B, org X/Y, workspace 1/2, acesso e módulos habilitados/suspensos | JWT errado, owner sem grant, cache/SSE trocados, API direta, worker e Control DB indisponível negam; sem suprimir testes antigos | FC-01.02, FC-02.02, FC-03.03 | BLOQ |
| FC-05.02 | P1 | Homologação de release por SHA/digest e rollback do frontend/backend | Manager e Workspace com origins/clients próprios; UX atual preservada, ambiente e CI rastreados, aceitação produto | FC-04.02, FC-05.01 | BLOQ |

## Primeiro pacote de execução — FC-00/FC-01

Alvo inicial seguro, independente do rollout de banco: extrair responsabilidade do apps/workspace-web/src/App.tsx para shell, seleção de contexto e registro tipado de rotas/features **sem alteração funcional visível**. Manter os componentes atuais em apps/workspace-web/src/features e todos os imports compartilhados em packages/front-shared.

### Definição de pronto do primeiro PR técnico

1. Nenhuma alteração operacional em bancos, scripts de provisionamento, CI, login, API ou contrato visual.
2. Rotas e componentes atuais continuam acessíveis exatamente como antes; sem botões novos para áreas não implementadas.
3. Um registro de views/feature IDs existentes tem testes de unicidade, módulos desconhecidos e navegação.
4. Keycloak, callback PKCE, tenantId, organizationId, workspaceId, headers, SSE e ações de logout continuam com os mesmos contratos; trocar de contexto não mostra dados antigos.
5. CI principal para ambos os frontends e regressões API passa no SHA integrado, sem tocar em checkout de outro chat.
6. O PR declara os gates ainda bloqueados: Account UI real, multi-org, billing, dynamic entitlements e Manager homologado.

## Critérios de priorização e risco

- **Evitar framework fictício:** implementar somente features conhecidas; não criar pacote frontend-SDK nem plugins remotos agora.
- **Evitar segurança cosmética:** esconder menu é UX, não política de acesso. Primeiro provar deny no servidor para módulo sem entitlement.
- **Evitar regressão comercial:** não congelar desenvolvimento básico do CRM/Inbox por refatoração estética; manter o Product Gate MVP.
- **Evitar autorização cruzada:** Account Owner, Platform Owner, Org Admin e Workspace Supervisor são papéis diferentes. Papéis não criam membership nem FGA em silêncio.
- **Evitar dados duplicados:** distinguir Platform Organization de CRM Organization; mudanças de schema e nomenclatura pública só após contrato e teste.
- **Evitar deploy acidental:** nenhuma etapa desta WBS aprova migrations em DevServer01, remoção SQL 002, ações Keycloak/DB ou mudança em workflows/actions/main protection.

## Documentos de referência

- ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md — decisão de arquitetura.
- ADR-ACCOUNT-ORGANIZATION-UNIT-WORKSPACE-PROPOSAL.md — taxonomia e gates.
- ADR-CONTROL-TENANT-MODULE-COMPOSITION-20261110.md — separação Control/Tenant.
- WBS-ACCOUNT-KERNEL-MODULE-SCHEMAS-20261110.md — módulos e scripts SQL.
- WBS-PROGRAMA-SYNDES-20261110.md — WBS mestre e release.
- docs/product/MVP-SCOPE.md e docs/product/MODULE-ORDER.md — prioridade comercial.

## Incremento FC-01 em execução

[Relatório de implementação](FC-01-WORKSPACE-SHELL-REGISTRY-IMPLEMENTATION-20261110.md): shell extraído, registry estático de quatro views, hash routing e contexto scoped por API com teste de navegador A/B e logout. Nenhum código do Manager ou backend alterado. FC-01.02 inclui abort de requisições/streams por ciclo de vida de API e prova de browser mock com resposta antiga A entregue após seleção B; o Product Gate multi-org continua bloqueado. Estados acima indicam teste local, não deploy ou homologação.
