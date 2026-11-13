---
title: "I04 · Dependências e integrações"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dependências e integrações

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/STATUS.md)

> L52: **Entregável:** registro da diferença **artefatos SQL versionados × objetos SQL realmente existentes**, isolamento básico observado e dependências de aplicação. O próximo owner a auditar é **C01 — Control Plane** para reconciliar especificamente os contratos e tabelas de Control sem DDL involuntário.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/REFERENCIA-TECNICA.md)

> L78: `syndes_keycloak` e `syndes_openfga` são databases separados. OpenBao **não usa PostgreSQL**: mantém Raft próprio. Komodo usa MongoDB na stack de administração; nenhum deles vira tenant DB por associação.

> L82: - **CI baseline:** [GitHub Actions 43355545663](https://github.com/delmacy/syndes-system/actions/runs/43355545663), 24/24 `success` no SHA `1395597`. Testes de integração/restore descartáveis **não** provam aplicação das migrations no DevServer01.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/OPERACAO.md)

> L9: - [Evolução](EVOLUCAO.md): workpackages e dependências; nenhum item é concluído por estar planejado.

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

> L63: **Bloqueios e próximos owners:** [STATUS I04](STATUS.md), [contratos](chapters/04-contratos-e-dependencias-publicas.md) e [WBS](EVOLUCAO.md).

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/chapters/04-contratos-e-dependencias-publicas.md)

> L17: \| `tests/platform/postgres-smoke.sh` \| Teste de três bancos, negativa de Keycloak→Control, provisionamento duplicado e restore de fixture \| Ambiente **descartável de CI**, não evidência de restore real \|

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L39: \| Keycloak/FGA \| Bancos técnicos separados \| Identidade e autorização \| DBs presentes; tabelas internas não auditadas \|

> L84: **I04 não tem frontend nem endpoint HTTP público.** Apps comunicam-se via providers/ports e grants apropriados; o navegador não recebe DSN nem role de banco. Keycloak e OpenFGA são consumidores de stores técnicos separados. Manager não herda acesso às conversas e mensagens dos tenants.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
