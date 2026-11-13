---
title: "A04 · Dependências e integrações"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dependências e integrações

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 13/11/2026.** Fonte do inventário: checkpoint `94fdcc6` (auditoria estática sobre integração local `f4fbfe5`). Esta revisão documental parte de `3c1db91`. **NÃO HOMOLOGADO:** nenhuma consulta a secrets, Keycloak, OpenFGA, bancos operacionais ou deploy.

> L14: \| Testes \| Testes existentes e checkpoint estático \| Suite Node A04 não reexecutada neste incremento; dependências isoladas pendentes \|

> L22: \| A04.TEST.01 \| PENDENTE \| Instalar dependências pinadas em cópia descartável, compilar e executar testes A04 com relatório por SHA \|

> L24: \| A04.SEC.01 \| PENDENTE \| JWT, FGA, OpenBao, gates de módulo e fail-closed em ambiente autorizado \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/REFERENCIA-TECNICA.md)

> L8: - **Lista declarada:** `apps/core-host/config/modules.json` contém cinco plugins (CRM, Inbox, WhatsApp, Organizations e Support); `loadInstalledPlugins` valida identificadores, dependências e assets. Instalação, habilitação por tenant e entitlement são verificações distintas.

> L10: - **Dependências:** C01 Control para membership, lifecycle e catálogo; C03 Keycloak para JWT; C04 OpenFGA para permissões; C05 OpenBao para secrets; C06 Event Platform para entrega. Esses owners mantêm seus próprios contratos.

> L33: \| GET \| `/readyz` \| Dependências do Core \|

> L59: Fonte: `docs/evidence/checkpoints/A04-core-host-initial-20261113-0900.md` no branch de auditoria `docs/a04-code-audit-20261113` (não necessariamente incorporado nesta worktree). O checkpoint reportou validação lexical/catálogo e testes A04 **não executados** por ausência de dependências locais; não converter resultado histórico de outro SHA em teste desta revisão. Testes PG17/FGA e deploy real pendentes.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/OPERACAO.md)

> L7: 1. Confirmar SHA de código, lockfile, owners e ausência de edição concorrente. Preparar cópia **descartável** com dependências Node pinadas; rodar `npm run check` e suites A04, separando SKIP, PASS e falhas reais.

> L10: 4. Em ambiente autorizado, validar readiness, TLS, OpenBao, OpenFGA, revogação, entitlements e comportamento em indisponibilidade; não usar resultado sintético como homologação.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/chapters/04-contratos-e-dependencias-publicas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
