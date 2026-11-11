# ADR — OpenFGA service grants para consumidores do Event Bus (2026-11-11)

**Estado:** modelo e adapter implementados/testados em OpenFGA v1.22.1 descartável e em memória. **Não instalados, provisionados ou ativados no OpenFGA operacional.** Nenhum dispatcher, serviço de webhook ou tenant foi modificado.

## Contexto

O modelo anterior em `infra/security-access/fga-model.json` aceitava somente `user`, `tenant` e `resource`. As relações legadas `resource.viewer/editor` são restritas a `user`; o adapter `FgaPermission` existente serializa `user:<actor.id>` e não representa um service principal. Usar uma permissão de usuário no worker permitiria confusão de fronteiras de confiança.

## Modelo aditivo

- Tipo `service`: identidade técnica dedicada, distinta de `user`.
- Tipo `event_delivery`: recurso de permissão somente para consumo de eventos; não herda `resource.can_read` ou `resource.can_write`.
- Relação direta `event_delivery.processor` admite **apenas** `service`; `event_delivery.can_process` computa exclusivamente `processor`.
- Modelo antigo e grants de usuário permanecem inalterados, sem aceitação acidental de usuários na relação de processamento.
- Um grant deve ser uma tuple específica como `service:syndes-events-service` / `processor` / `event_delivery:<sha256>`, nunca um grant wildcard ou tenant-wide.

O ID do objeto é SHA-256 de **seis valores** separados por U+001F: tenantId, organizationId, workspaceId (ou sentinela fixa), moduleId, consumerId e eventType. O hashing não grava corpo, nome, telefone, JID, JWT ou tokens de acesso. A permissão é **exata** e muda quando qualquer dimensão muda. Um único principal pode ter várias tuples aprovadas individualmente.

## Adapter Host (sem startup)

`apps/core-host/src/platform-event-service-grant.ts` implementa `TrustedServiceEventGrant`, a porta obrigatória da PR #89:
- recebe configuração e identidade técnica injetadas pelo Host, validadas e nunca obtidas de request/header/frontend;
- envia `POST /stores/{store}/check` com sujeito **`service:`**, relação `can_process` e objeto `event_delivery:`;
- retorno booleano explícito; erro, timeout ou resposta inválida lançam exceção, que `TenantEventWorkerAdmission` trata como entrega `suspended` recuperável;
- exige HTTPS, ou HTTP apenas para `openfga` interno e localhost; não aceita credentials embutidas, caminhos ou host arbitrário em HTTP;
- não cria stores, modelos, grants ou workers na construção.

A camada `PgEffectiveModuleAccess` continua necessária: grants OpenFGA não substituem estado ENABLED, attestation, tenant registry, escopo Organization/Workspace ou autorização de domínio.

## Prova local e teste contínuo

- `platform-event-service-grant.test.mjs`: valida escopo exato, não divulgação de identificadores, identidade service, configuração, negativa, timeout, falta de grant e isolamento da semântica legada.
- `platform-event-service-grant-fga.test.mjs`: só roda quando uma instância OpenFGA **descartável em memória**, com nome/label/porta local verificadas, é explicitamente ativada pelo operador. Usa store totalmente novo: unprovisioned=false, grant=true, seis dimensões divergentes=false, outro principal=false, users antigos sem regressão e revogação imediata=false.
- `tests/platform/openfga-smoke.sh`: a suíte existente já cria um store próprio e agora valida as novas tuples de serviço, isolamento por tenant e revogação. **Não muda workflows GitHub Actions**.

## Gates operacionais que continuam bloqueados

1. Revisar e aprovar **nova versão de modelo OpenFGA** para um store de staging segregado, sem escrever no store ativo; registrar model ID, checksum, operador e rollback.
2. Provisionar identidade técnica imutável, credencial OpenBao com privilégios mínimos, ACL de criação/revogação de tuples e rotação; não reutilizar tokens de Keycloak de usuários.
3. Registrar grants `processor` somente para consumidores confiáveis, por tenant/org/workspace, com auditoria, revogação e teste de replay de deliveries. Nunca permitir que um worker auto-conceda seu grant.
4. Migrations Control/tenant seguem bloqueadas até restore real homologado. FGA pode ser testado em store descartável agora, mas não autoriza DDL.
5. Não ligar scheduler, Webhook transactional bridge ou projetor novo antes da janela de canário/rollback, observabilidade e enablement reais.

**Estados:** modelo+adapter codificados/testados não equivalem a store de produção migrado, grants provisionados, worker operacional ou frontend integrado.
