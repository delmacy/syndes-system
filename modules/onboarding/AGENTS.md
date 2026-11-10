# AGENTS.md — Onboarding

## Missão

Transformar contratação aprovada em tenant operacional de modo repetível e idempotente.

## Fluxo

cliente → tenant → database → storage → admin → plano → módulos → configuração → tenant ativo.

## Regras

- UI não executa operações privilegiadas diretamente.
- Provisioning executa operações e registra estado.
- Cada step deve poder ser retomado.
- Retry não pode criar recurso duplicado.
- Secrets são referenciados, não expostos.
- Falha parcial deve ser observável e recuperável.

## Não fazer

- instalador universal de módulos futuros;
- dezenas de cenários pós-MVP;
- provisionamento hyperscale.

## Testes

- happy path;
- retry/idempotency;
- partial failure;
- resume;
- duplicate request;
- permissions;
- database/storage mapping;
- audit.

## Contrato transversal de módulos, schemas e metering (2026-11-10)

- Módulo possui schema PostgreSQL próprio nomeado pelo ID curto, após a fase de migração aprovada. Nenhum módulo controla schemas/tabelas de outros ou altera o Control DB por acesso direto. Integração entre módulos ocorre por API/contrato/eventos ou views de leitura aprovadas com dependências declaradas.
- Acesso depende de identidade Keycloak, membership tenant/org/workspace quando aplicável, habilitação no catálogo do Control Plane e OpenFGA; não utilizar `tenant_id` enviado pelo browser como autoridade. Desativar módulo não apaga dados. Migrações apenas por instalador aprovado e testes PG17 descartáveis.
- Se houver medição de uso necessária, declarar a métrica e sua fonte com idempotência; não atribuir preço, cobrar por retries nem implementar Billing/Payments dentro do domínio. O PRD-009 de Subscription & Billing continua posterior ao núcleo operacional.
- Consultar `AGENTS.md` da raiz, `docs/engineering/BILLING-METERING-FOUNDATION-20261110.md` e WBS/ADR da PR #65; não declarar schema migrado antes de comprovação SQL/Host/testes.