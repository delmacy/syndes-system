---
title: "C04 · Contratos e dependências"
description: "Volume Plataforma e core · capítulo C04 · matéria 04"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/chapters/04-contratos-e-dependencias-publicas.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 4. Contratos e dependências públicas

Contrato externo OpenFGA: `POST /stores/{store}/check` com `tuple_key`, retornando `allowed` booleano. **Store/model ID e grants efetivos não verificados.**

- C04 modelo: `resource`/ `tenant` / `user` para `can_read` e `can_write`; `event_delivery` / `service` para `can_process`.
- A04 `FgaPermission.canAccess`: objeto `resource:{hash(tenant|resource)}`, principal `user:`, `can_read/can_write`.
- A06 `createFgaWriteAuthorizer`: conta com grant de escrita; não implanta tuples.
- A04/C06 `fgaEventDeliveryObject`, `OpenFgaServiceEventGrant.canProcess`: check `service:` e `event_delivery:`.
- C01 `tenant_memberships` e enabled-module gate são externos a C04; proteção não pode depender só de resposta FGA.

Esses símbolos pertencem aos packages citados, **não** constituem classes/API pública de `infra/security-access/fga-model.json`.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/chapters/04-contratos-e-dependencias-publicas.md).
