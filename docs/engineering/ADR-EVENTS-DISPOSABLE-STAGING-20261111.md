# ADR — Ensaio integrado de eventos em staging descartável (2026-11-11)

**Status:** execução concluída localmente em PostgreSQL 17 e OpenFGA v1.22.1 **descartáveis**, com dados sintéticos e módulos reais do Syndes. **Não é staging operacional homologado, não é deploy, não usa dados dos clientes e não fecha o gate de restore real.**

## Objetivo e contexto

As PRs #83–#90 entregaram os contratos de eventos, outbox tenant-local, dispatcher, cadeia WhatsApp → Inbox → CRM → Inbox, trilha global Control Plane, admissão fail-closed e modelo/adaptor de identidade técnica OpenFGA. Faltava provar a sequência **reunida** com dados verdadeiramente persistidos em PostgreSQL e autorização via OpenFGA real, além de um mecanismo de processamento controlado.

## Arquitetura do ensaio

- `TenantEventWorkerBatch` em `apps/core-host/src/platform-event-worker-batch.ts` recebe somente um `TenantEventDispatcher` já composto por trusted Host ports, exige UUID de tenant, faz um `routePending` e até **100** tentativas de entrega; devolve somente contadores sem dados de contato, mensagem ou JID. Não tem timer, discovery, daemon, endpoint HTTP, variáveis de feature flag nem startup NestJS. Um batch pode suspender deliveries ou retornar uma falha; não presume autorização.
- `apps/core-host/test/platform-events-disposable-staging-pg17-fga.test.mjs` é harness explícito. Só executa com `SYNDES_EVENTS_DISPOSABLE=EVENTS_TEST_ONLY`, `SYNDES_EVENTS_FGA_DISPOSABLE=EVENTS_FGA_IN_MEMORY_ONLY`, conexão localhost PG17 específica e URL FGA localhost específica. Antes de operar, usa `docker inspect` para exigir **nomes, labels, imagens e binding de loopback específicos**. Nunca aceita DSN, token ou store operacional. O teste cria e destrói seus próprios databases e store in-memory.
- O Control DB de teste é o `syndes_control` **somente dentro do contêiner descartável**, porque a migration 006 verifica o nome do database e rejeita qualquer outro. As migrations 001–006 são aplicadas na fixture, junto com as migrations de Organizations/CRM/Inbox/WhatsApp/platform_events no database tenant sintético. O teste **semeia manualmente** metadados de instalação ENABLED e verificação para focar a admissão; isso não substitui ensaio do operador de instalação/attestation.
- O OpenFGA da fixture possui modelo real `service`/`event_delivery` da PR #90, store novo e grants explícitos para os **três consumidores**. A autenticação da API do contêiner é desabilitada por ser uma fixture totalmente isolada, portanto o teste valida a semântica de autorização, **não** a custódia de tokens OpenBao. Não toca no store OpenFGA operacional.
- A cadeia executa uma mensagem **somente texto** por `WhatsAppTransactionalInboundBridge` → `InboxWhatsAppReceivedConsumer` → `CrmWhatsAppIdentityConsumer` → `InboxCrmPersonResolvedConsumer`, através do factory já existente. A Inbox permanece dona das conversas/mensagens, CRM da política de identidade e WhatsApp da rota e confirmação.

## Invariante de segurança comprovado

1. Ausência de grant OpenFGA é negada sem executar efeitos.
2. Desabilitar dependência CRM faz o módulo Inbox falhar fechado e mantém a delivery **suspended** sem gastar tentativas ou perder a mensagem.
3. Restabelecer o estado ENABLED e o próximo attempt permite resolver a pessoa existente e vincular `crm_person_id` exatamente uma vez.
4. O mesmo inbound recebido duas vezes retorna como duplicado, sem novo outbox/Inbox effect.
5. A revogação do grant `service:...` / `processor` em `event_delivery:...` impede processar novos eventos e resulta em dead-letter lógico por negativa explícita (não é recuperação automática, depende de revisão autorizada). Os dados já processados permanecem consistentes.
6. As mensagens (texto, telefone e JID) não entram no payload do ledger de eventos.

## Execução reproduzível

```bash
bash scripts/events/run_disposable_staging.sh --disposable --ack-synthetic
```

O script operador rejeita argumentos incompletos e contêineres/portas já existentes, cria fixtures `postgres:17-alpine` e `openfga/openfga:v1.22.1` isoladas por nomes/labels, sem volume persistente, com as portas **somente em 127.0.0.1**. Diferentemente do ensaio de backup `--network none`, aqui a comunicação do test runner Node com as duas APIs precisa de binding localhost; o Docker usa bridge, não `network none`. O script roda builds e testes; seu trap só remove contêineres com **nome, label e imagem de fixture esperados**.

O teste por si só não é incluído no bootstrap, não tem scheduler, não provisiona nem implanta novos módulos. Core Host e frontends operacionais continuam usando o caminho WhatsApp textual legado.

## Limitações e próximos gates

- Os testes dispensam a configuração operacional de Keycloak, OpenBao, FGA com token real, instalador de módulos e papéis ACL restaurados; por isso não provam um deployment homologado.
- Continuam **não executadas** as migrations Control 001–006, tenant events 001–002 no ambiente operacional. Sem backup/restore **real** testado não há autorização para aplicá-las, nem em dados de cliente nem automaticamente em staging.
- O modelo SQL 002 mantém single Organization/Workspace. Não habilitar multiorg, reconciliação automática de 14 contatos ou mídias WhatsApp.
- O cutover entre projetor legado e novo consumer, a reversão em canário, as métricas operacionais, entrega/review de ambiguidades e o comportamento HTTP/UI autenticado ainda não foram homologados.
- A execução limitada por lote deve ser invocada **somente pelo scheduler futuro** com identidade de serviço real, descoberta de tenant por Control registry e feature gate de cutover sob controle exclusivo do Host. Este incremento não o conecta ao runtime.

**Evidência ≠ autorização:** teste PG17+FGA descartável = prova de integração funcional; não implica deploy, migração operacional ou que o front mostre a cadeia nova.
