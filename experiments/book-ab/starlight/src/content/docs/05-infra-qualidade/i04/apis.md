---
title: "I04 · APIs e endpoints"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# APIs e endpoints

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/STATUS.md)

> L12: \| **Isolamento de CONNECT** \| `PUBLIC` sem CONNECT nos DBs técnicos e tenant; `syndes_core` e `syndes_master_api` sem CONNECT no tenant; role tenant sem superuser, CREATEDB ou CREATEROLE \| Não comprova negação de API, FGA ou todo tenant futuro \|

> L27: 4. **P1 — Teste de isolamento incompleto.** `CONNECT` e grants básicos estão restritivos no banco examinado, mas falta matriz SQL completa e teste API/authorization A/B contra providers reais.

> L39: \| **55.03** \| Installer, canonicidade e schema/gates \| API opt-in/PG17 sintético; Control/restore/FGA reais BLOQ \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/REFERENCIA-TECNICA.md)

> L7: **PostgreSQL 17**, Docker Compose, bancos separados por função e por tenant, roles isoladas, secrets por arquivo e SQL versionado. I04 é infraestrutura, **não possui package.json, frontend, APIs HTTP, classes NestJS ou eventos de negócio próprios**. Os dados de domínio e providers SQL pertencem a seus módulos.

> L57: Não confundir funções do **migrador de operador** com endpoints públicos. Scripts de provisioning e manutenção são interfaces privadas. O site público não publica valores de secrets, DSNs, nomes reais de tenants, dados de usuários nem comandos de aplicação de migration.

> L84: - **Pendências:** reconciliar Control schema/migrator, classificar DB adicional, identificar finalidade do tenant canônico, comprovar backup/restore real, A/B de API e staging/produção.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/chapters/04-contratos-e-dependencias-publicas.md)

> L3: I04 expõe **contratos de PostgreSQL/SQL e scripts operacionais**, não endpoints REST, eventos SaaS ou `package exports`.

> L10: \| `bootstrap/provision-tenant.sh` \| `TENANT_ID` UUID validado; role `syndes_t_<uuid sem hífens>`, DB `syndes_tenant_<uuid>`, `REVOKE CONNECT`, estado `provisioned` \| Requer operador e senha única protegida; **não é API pública** \|

> L16: \| `bootstrap/support-migration-gate.sh` \| Support migration somente se `TENANT_ID` corresponder ao tenant operacional permitido \| Evita provisionar Support em tenant comercial; não é autorização de API \|

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L84: **I04 não tem frontend nem endpoint HTTP público.** Apps comunicam-se via providers/ports e grants apropriados; o navegador não recebe DSN nem role de banco. Keycloak e OpenFGA são consumidores de stores técnicos separados. Manager não herda acesso às conversas e mensagens dos tenants.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
