# AGENTS.md — Platform Core

## Missão

Fornecer somente as capacidades transversais necessárias para os módulos atuais: Identity, Tenancy, Authorization, Resource Registry, Module Registry, Entitlements, Audit, Events, Provisioning e Configuration.

## Não fazer

- Não construir plataforma genérica antes dos módulos.
- Não criar plugin marketplace.
- Não antecipar SAML/SCIM/federação complexa.
- Não criar policy language própria.
- Não criar orquestrador universal.

## Invariantes

- Tenant sempre resolvido server-side.
- Control Plane separado dos bancos de tenant.
- Cada tenant possui database próprio.
- Platform admin não ganha acesso automático aos dados de negócio.
- Secrets não ficam em registros de negócio.
- Provisioning deve ser idempotente.
- Entitlements são autoridade de habilitação; módulos não duplicam regras de billing.

## Testes mínimos

- tenant resolution;
- membership/authorization;
- cross-tenant denial;
- idempotência de provisioning;
- entitlement transitions;
- audit events;
- migrations do Control Plane.

## Done

Capacidade transversal é DONE quando atende o módulo consumidor atual com segurança e testes, sem ampliar a plataforma por antecipação.

## Contrato transversal de módulos, schemas e metering (2026-11-10)

- Módulo possui schema PostgreSQL próprio nomeado pelo ID curto, após a fase de migração aprovada. Nenhum módulo controla schemas/tabelas de outros ou altera o Control DB por acesso direto. Integração entre módulos ocorre por API/contrato/eventos ou views de leitura aprovadas com dependências declaradas.
- Acesso depende de identidade Keycloak, membership tenant/org/workspace quando aplicável, habilitação no catálogo do Control Plane e OpenFGA; não utilizar `tenant_id` enviado pelo browser como autoridade. Desativar módulo não apaga dados. Migrações apenas por instalador aprovado e testes PG17 descartáveis.
- Se houver medição de uso necessária, declarar a métrica e sua fonte com idempotência; não atribuir preço, cobrar por retries nem implementar Billing/Payments dentro do domínio. O PRD-009 de Subscription & Billing continua posterior ao núcleo operacional.
- Consultar `AGENTS.md` da raiz, `docs/engineering/BILLING-METERING-FOUNDATION-20261110.md` e WBS/ADR da PR #65; não declarar schema migrado antes de comprovação SQL/Host/testes.
## Account & Access e Metering (2026-11-10)

O Core Kernel permanece biblioteca pequena sem lógica comercial. O Core Host é a composition root de módulos confiáveis; Account Access coordena decisões administrativas sem duplicar Keycloak/OpenFGA/OpenBao. Catálogo/quotas e estados de instalação do módulo pertencem ao Control Plane, SQL de migrations instalado em tenant DB por operador confiável. Metering descreve o que medir; Billing futuro calcula o que cobrar. Nunca inferir privilégios operacionais por ser proprietário global ou titular da conta.