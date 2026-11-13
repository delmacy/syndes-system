---
title: "I04 · Contratos públicos e privados"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Contratos públicos e privados

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/STATUS.md)

> L9: \| **Documentação I04** \| **AUDITORIA PARCIAL:** SQL/Compose, contratos, 8 capítulos, bancos/roles/grants, diagrama e WBS reconciliados \| Ratificação pelos owners/DBA pendente \|

> L52: **Entregável:** registro da diferença **artefatos SQL versionados × objetos SQL realmente existentes**, isolamento básico observado e dependências de aplicação. O próximo owner a auditar é **C01 — Control Plane** para reconciliar especificamente os contratos e tabelas de Control sem DDL involuntário.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/REFERENCIA-TECNICA.md)

> L9: \| Recurso \| Fonte de contrato \| Conclusão \|

> L16: \| Migrations Tenant \| `infra/postgres/bootstrap/migrate-modules-tenant.sh`, `tenant-module-ledger.schema` \| Imagem por `@sha256`, mapping verificado e ledger de execução privado; **não executado** \|

> L17: \| Persistência de módulos \| `modules/{core-crm,inbox,whatsapp,organizations,support,service-management}/sql` \| Contratos SQL de cada owner, não instalações comprovadas no tenant examinado \|

> L44: \| Assinatura / interface \| Owner \| Efeito ou contrato \|

> L57: Não confundir funções do **migrador de operador** com endpoints públicos. Scripts de provisioning e manutenção são interfaces privadas. O site público não publica valores de secrets, DSNs, nomes reais de tenants, dados de usuários nem comandos de aplicação de migration.

> L73: - O ledger de migration `_syndes.module_migrations` é **protegido contra runtime role**, conforme contrato versionado, mas não estava criado no DB consultado.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/OPERACAO.md)

> L16: - [Contratos públicos](../../standards/CONTRATOS-PUBLICOS.md).

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

> L63: **Bloqueios e próximos owners:** [STATUS I04](STATUS.md), [contratos](chapters/04-contratos-e-dependencias-publicas.md) e [WBS](EVOLUCAO.md).

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/chapters/04-contratos-e-dependencias-publicas.md)

> L3: I04 expõe **contratos de PostgreSQL/SQL e scripts operacionais**, não endpoints REST, eventos SaaS ou `package exports`.

> L10: \| `bootstrap/provision-tenant.sh` \| `TENANT_ID` UUID validado; role `syndes_t_<uuid sem hífens>`, DB `syndes_tenant_<uuid>`, `REVOKE CONNECT`, estado `provisioned` \| Requer operador e senha única protegida; **não é API pública** \|

> L22: - **Contratos públicos de módulos:** APIs/ports/versionamento de CRM, Inbox, WhatsApp, Organizations, Support e Service pertencem aos owners; SQL infra de I04 não é biblioteca reutilizável pelo frontend.

> L23: - **Contrato privado de infraestrutura:** formatos de DB/role, grants, transação e ledger. O nome canônico é derivado do UUID aprovado **server-side**, sem escolher banco por parâmetro de cliente.

> L30: Control base (registry/membership) e Manager base estão **instalados**; catálogo/entitlements/events de módulos estão **ausentes** na instância examinada. O migrador Control de fato informa as seis etapas como **PENDING**. No DB tenant observado, os schemas de módulo e o ledger `_syndes` não apareceram. Isso é **diferença de estado**, não falha comprovada dos contratos versionados.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
