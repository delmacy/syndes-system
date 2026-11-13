---
title: "A04 · Controle de escopo"
description: "Volume Plataforma e core · capítulo A04 · matéria 07"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/chapters/07-controle-do-escopo.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 7. Controle do escopo

- Fonte de auditoria: checkpoint `94fdcc6`, integração documental local `f4fbfe5`, branch de reconciliação própria.
- Não executar `PgModuleInstaller.apply/enable/disable`, migrations, SQL operacional, worker, rotação ou deploy.
- Não declarar homologação a partir de código versionado, testemunhas lexicais ou testes históricos.
- Preservar ownership de módulos, Control e C06; inventariar controllers, SSE e jobs separadamente.
- Publicação só se confirma por push, CI Pages e SHA efetivamente servido no site.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/chapters/07-controle-do-escopo.md).
