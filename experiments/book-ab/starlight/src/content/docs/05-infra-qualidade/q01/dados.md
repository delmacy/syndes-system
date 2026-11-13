---
title: "Q01 · Dados e persistência"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dados e persistência

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/STATUS.md)

> L11: \| **Estrutura/validação local** \| Leitura/checagem de fontes, sintaxe e integridade não destrutiva realizadas nesta revisão (ver checkpoint) \| Não cria fixture de identidade ou dados de cliente \|

> L22: \| DB/roles \| `postgres-smoke.sh`, `account-roles-pg-smoke.sh`, `platform-manager-postgres-smoke.sh` \| Exigir fixture, flags, negativas de acesso, cleanup e run \|

> L31: 2. **Provas descartáveis versus operação real:** PostgreSQL, OpenFGA, Keycloak, OpenBao e restore testados em CI não constituem restore/rollout operacional.

> L42: **Próxima unidade do plano documental:** **P14 — Platform Core**, com validação do inventário lógico de core antes de atribuir APIs, classes ou persistência.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/REFERENCIA-TECNICA.md)

> L7: - **Test runner:** Bash, Python e Node.js ESM, com Docker Compose/containers de PostgreSQL 16/17 conforme cenário, Keycloak, OpenFGA e OpenBao descartáveis. Ferramentas e versões variam pelo job do Q07; não existe um `package.json` central em `tests/`.

> L19: \| `bash tests/platform/postgres-smoke.sh` \| `tests/platform/postgres-smoke.sh` \| `pg_isready`, DB Control/Identity, roles/tenant e restore sintético \|

> L33: - **Banco PostgreSQL:** `tests/platform/postgres-smoke.sh` valida múltiplos DBs/roles em fixture. `modules/service-management/test/service-funnels-pg17.test.mjs` possui seu próprio banco de ensaio sob o owner P05.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/chapters/04-contratos-e-dependencias-publicas.md)

> L10: \| `tests/platform/postgres-smoke.sh` \| Compose PostgreSQL descartável \| DB/roles, tenant registry, dump/restore de fixture \| Testes só em ambiente CI; nenhuma mudança operacional \|

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L26: \| Ambiente \| Propósito \| Dados e isolamento \| O que não se pode concluir \|

> L29: \| Teste PG17 descartável \| Persistência/roles/tenant, Serviço e migrations \| Container efêmero, portas restritas/labels, cleanup \| Migration de produção aplicada \|

> L37: `Control Plane` mantém registry, roles e escopo global; cada `tenant database` é isolado. Os testes de PostgreSQL exercitam proibição de conexões indevidas e provisionamento de fixture, mas não criam dados permanentes da Q01. Os testes de OpenFGA validam grants simulados de A/B; os de Keycloak usam identidades descartáveis. **Q01 não cria database, tabela nem migration próprias.**

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
