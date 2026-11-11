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

## Platform Events — primeiro incremento

- Contratos tipados em packages/core-kernel/src/platform-events.ts.
- Infraestrutura em apps/core-host/src/tenant-database.ts e platform-event-publisher.ts.
- Migration 001 emitida via apps/core-host/dist/migrations.js --emit platform_events 001_platform_events; deve depender de organizations 001.
- Nunca disparar migration em tenant operacional sem backup/restore testado, aprovação e janela de implantação. Control DB permanece fora desta mudança.
