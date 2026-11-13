---
title: "A06 · Eventos e mensageria"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Eventos e mensageria

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/STATUS.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/REFERENCIA-TECNICA.md)

> L35: apps/account-access-api/test/server.test.mjs e auth.test.mjs passaram 10/10 em /tmp descartável. pg-e2e.mjs e tests/platform/account-roles-pg-smoke.sh não executados. Sem prova de banco, grants, deploy ou eventos de domínio publicados pelo HTTP.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/chapters/04-contratos-e-dependencias-publicas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L3: Fluxo: HTTP POST -> JWT RS256 -> OpenFGA can_write -> SQL Control SECURITY DEFINER -> resposta sanitizada. Persistência Control, não Tenant DB. Segredos via /run/secrets; rede loopback por padrão; frontend próprio inexistente. Nenhum evento de negócio publicado pela API HTTP foi identificado.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
