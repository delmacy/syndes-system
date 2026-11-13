---
title: "C04 · Missão e fronteiras"
description: "Volume Plataforma e core · capítulo C04 · matéria 01"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/chapters/01-missao-objetivos-e-fronteiras.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 1. Missão, objetivos e fronteiras

C04 fornece a **decisão relacional de autorização** por OpenFGA. A autenticação JWT é de C03/consumidores, membership e catálogo de módulos são C01, o escopo Organization/Workspace é P04 e a entrega de eventos pertence a C06. C04 não é fonte canônica de pessoas CRM, mensagens ou banco tenant.

Tipos documentados: `user`, `tenant`, `resource`, `service`, `event_delivery`. Permissões de usuário (`can_read/can_write`) não autorizam serviço (`can_process`). Configurações reais/tuples não inspecionadas.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/chapters/01-missao-objetivos-e-fronteiras.md).
