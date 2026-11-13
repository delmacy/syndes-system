---
title: "C04 · Controle de escopo"
description: "Volume Plataforma e core · capítulo C04 · matéria 07"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/chapters/07-controle-do-escopo.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 7. Controle do escopo

- Baseline `2e1707c`, auditoria somente leitura de 13/11/2026.
- Contrato versionado: tipos/relações JSON e adapters dos owners A04/A06/C06; instalação real não verificada.
- Não autorizado: criar tuples/grants, alterar modelo, OpenBao, bancos, infra, Frontend, CI ou iniciar worker.
- C04 não substitui `C01` memberships/entitlements nem `C03` identidade; `user` e `service` não são intercambiáveis.
- Evolução com teste negativo, revisão owner e evidência separada de sintético vs. homologado.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/chapters/07-controle-do-escopo.md).
