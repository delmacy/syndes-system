---
title: "C05 · Missão e fronteiras"
description: "Volume Plataforma e core · capítulo C05 · matéria 01"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/chapters/01-missao-objetivos-e-fronteiras.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 1. Missão, objetivos e fronteiras

C05 gerencia confiança de bootstrap, emissão e entrega de segredos. Não controla identidade JWT (C03), políticas OpenFGA (C04), membership Control (C01) ou schemas Tenant. A04 Core Host e Master-Admin são consumidores/operadores distintos.

O servidor OpenBao do Compose usa TLS e Raft `openbao_raft`. Isso não implica unseal, KV provisionado ou HA. A configuração versionada pode divergir do estado efetivo em DevServer01; a auditoria não consultou secrets, roles nem seal status.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/chapters/01-missao-objetivos-e-fronteiras.md).
