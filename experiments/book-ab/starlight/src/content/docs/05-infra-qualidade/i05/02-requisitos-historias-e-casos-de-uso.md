---
title: "I05 · Requisitos e casos de uso"
description: "Volume Infraestrutura e qualidade · capítulo I05 · matéria 02"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/chapters/02-requisitos-historias-e-casos-de-uso.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 2. Requisitos, histórias e casos de uso

| ID | Requisito | Evidência/aceite |
|---|---|---|
| I05-RF01 | Separar redes de dados, identidade, segredos e Manager | Compose versionados; validação efetiva pendente |
| I05-RF02 | Restringir portas publicadas | PostgreSQL sem porta host declarada; Master Web bind loopback; inventário global pendente |
| I05-RF03 | Proteger workloads e volumes | `no-new-privileges`, `read_only`, `cap_drop` em serviços específicos; runtime não validado |
| I05-RF04 | Evitar vazamento de secrets em docs/logs | Referências a arquivos runtime; material não consultado |
| I05-RF05 | Validar isolamento negativo entre redes | Teste segregado e autorização pendentes |


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/chapters/02-requisitos-historias-e-casos-de-uso.md).
