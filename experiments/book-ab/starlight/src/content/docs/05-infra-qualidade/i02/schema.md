---
title: "I02 · Schemas e migrations"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Schemas e migrations

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/STATUS.md)

> L28: 7. **P1 — continuidade.** Contagem de 19 volumes, arquivos SQL e scripts de restore não certificam RPO/RTO, backup, migrações ou rollback de produção.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/REFERENCIA-TECNICA.md)

> L11: \| [`infra/postgres/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/infra/postgres/compose.yaml) \| 1 serviço PostgreSQL 17-bookworm, volume de dados, secrets por arquivo, redes de dados e Manager \| I04/C01/C02: databases/roles, migrations/tenants separados \|

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/OPERACAO.md)

> L31: 3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/chapters/04-contratos-e-dependencias-publicas.md)

> L8: \| Bootstrap de Control/Tenant \| `infra/postgres/bootstrap/*` — C01/C02/I04 \| SQL e shell de provisionamento autorizados; init só em volume novo, migrations requerem gate próprio \|

> L22: 3. PostgreSQL e databases técnicos preparados; migrations e roles executados com ownership e backup.

> L37: Mudanças de rede, porta, volume, backup, migration, service user ou proxy exigem escopo, owner e evidência fora desta auditoria de leitura.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L34: \| `infra/security-access/compose.yaml` \| Keycloak, FGA migration/API, OpenBao/Raft \| Keycloak, OpenFGA e OpenBao `Up` \| TLS interno, health funcional, realm/store, rotação \|

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
