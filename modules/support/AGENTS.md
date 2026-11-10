# AGENTS.md — Core Support
Produto: exclusivamente o atendimento do **tenant operacional Syndes**. Escopo da issue #32 e PRD/ADR/WBS Syndes Support prevalecem sobre suposições.

- Não instalar outro helpdesk nem criar sistema CRM/Inbox paralelo.
- Configuração server-side de tenant Syndes; não inferir do parâmetro HTTP.
- Verificação Keycloak + tenancy + OpenFGA ANTES de resolver DB; SQL verifica solicitante/membro da fila.
- Sem privilégios implícitos de Platform Manager; nada de consultas em tenant de cliente.
- Separar tipos de ticket, filas, autorizações, eventos e dados.
- Toda mutação auditada atomicamente. Notes nunca são outbound.
- SQL aditivo e idempotente; sem dados reais em testes.
- Testes negativos tenant/queue/actor/UUID, regressão e PG antes de release.
- Sem SSE, SLAs, IA, dashboards, API de grants, botões ou filtros não planejados.

## Contrato transversal de módulos, schemas e metering (2026-11-10)

- Módulo possui schema PostgreSQL próprio nomeado pelo ID curto, após a fase de migração aprovada. Nenhum módulo controla schemas/tabelas de outros ou altera o Control DB por acesso direto. Integração entre módulos ocorre por API/contrato/eventos ou views de leitura aprovadas com dependências declaradas.
- Acesso depende de identidade Keycloak, membership tenant/org/workspace quando aplicável, habilitação no catálogo do Control Plane e OpenFGA; não utilizar `tenant_id` enviado pelo browser como autoridade. Desativar módulo não apaga dados. Migrações apenas por instalador aprovado e testes PG17 descartáveis.
- Se houver medição de uso necessária, declarar a métrica e sua fonte com idempotência; não atribuir preço, cobrar por retries nem implementar Billing/Payments dentro do domínio. O PRD-009 de Subscription & Billing continua posterior ao núcleo operacional.
- Consultar `AGENTS.md` da raiz, `docs/engineering/BILLING-METERING-FOUNDATION-20261110.md` e WBS/ADR da PR #65; não declarar schema migrado antes de comprovação SQL/Host/testes.