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
- Dispatcher candidato: `apps/core-host/src/platform-event-dispatcher.ts`. Inscrições confiáveis, claim `FOR UPDATE SKIP LOCKED`, efeitos e consumer_inbox na mesma transação. Falhas temporárias de autorização e ausência de handler preservam entregas `suspended`; negativa explícita pode ir a `dead`.
- Nenhum scheduler, FGA/ENABLED operacional ou worker automático antes de provisionamento autorizado. A engine testada em banco descartável não equivale a deploy.
- O publisher/dispatcher devem validar a igualdade entre sufixo do tipo `.vN` e `event_version`. A migration 002 adiciona uma restrição no tenant ledger (não alterar a 001). Nenhuma DDL operacional antes de backup/restore e autorização.
- Eventos de Control Plane são tipos separados em `packages/core-kernel/src/control-plane-events.ts`. A migration offline `006_control_events` adiciona schema no `syndes_control` e trigger no audit ledger de módulos, sem worker ou grants de runtime; validar somente em PG17 descartável e nunca ativar enforcement sem os gates do Control DB.
- A admissão do Event Worker exige `PgEffectiveModuleAccess` (Control ENABLED/attested/dependency), scope ativo no tenant DB, identidade service confiável e `TrustedServiceEventGrant` FGA, sem fallback. A composição WhatsApp/Inbox/CRM em `platform-event-worker-composition.ts` é construtor opt-in e não runtime iniciado. Sem grant real, sem scheduler. ADR `docs/engineering/ADR-EVENTS-STAGING-WORKER-ADMISSION-20261111.md`.
