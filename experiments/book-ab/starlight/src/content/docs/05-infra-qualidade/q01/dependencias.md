---
title: "Q01 · Dependências e integrações"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dependências e integrações

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/STATUS.md)

> L12: \| **Integração CI central** \| [Run 43340637846](https://github.com/delmacy/syndes-system/actions/runs/43340637846) no SHA `bd0aa69349879485156ce05ffcb211904d34c206`: **24/24 jobs success**, incluindo infra, Manager, Support e Serviço \| Ambiente GitHub Actions descartável, não release de produção \|

> L23: \| Keycloak/OpenFGA/OpenBao \| `platform-manager-keycloak-ci.mjs`, `openfga-smoke.sh`, `openbao-smoke.sh` \| Ambientes descartáveis e permissão/denegação testadas \|

> L25: \| Diretrizes de integração/segurança \| `tests/integration/AGENTS.md`, `tests/security/AGENTS.md` \| Testes localizados nos módulos/plataforma; não declarados prontos só pelo AGENTS \|

> L31: 2. **Provas descartáveis versus operação real:** PostgreSQL, OpenFGA, Keycloak, OpenBao e restore testados em CI não constituem restore/rollout operacional.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/REFERENCIA-TECNICA.md)

> L7: - **Test runner:** Bash, Python e Node.js ESM, com Docker Compose/containers de PostgreSQL 16/17 conforme cenário, Keycloak, OpenFGA e OpenBao descartáveis. Ferramentas e versões variam pelo job do Q07; não existe um `package.json` central em `tests/`.

> L20: \| `fga()`, `check()` \| `tests/platform/openfga-smoke.sh` \| Chamadas a OpenFGA de CI e verificação allow/deny \|

> L21: \| `bao_http()`, `unseal()` \| `tests/platform/openbao-smoke.sh` \| Health/TLS e lifecycle de secretos descartáveis \|

> L23: \| `platform-manager-keycloak-ci.mjs` \| `tests/platform` \| Testes de realm e tokens assinados de Keycloak efêmero \|

> L34: - **Autorização/identidade:** OpenFGA/Keycloak de CI testam políticas e JWT, sem se conectar ao tenant/realm operacional.

> L35: - **Segredos:** OpenBao e `ci-secret-fixtures.py` usam fixture; valores não devem constar no Docs nem serem reutilizados em ambientes reais.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/OPERACAO.md)

> L9: - [Evolução](EVOLUCAO.md): workpackages e dependências; nenhum item é concluído por estar planejado.

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/chapters/04-contratos-e-dependencias-publicas.md)

> L11: \| `tests/platform/openfga-smoke.sh` \| OpenFGA e modelo de teste \| Check allow/deny, isolamento A/B \| Store/test token descartáveis; FGA real da plataforma pertence a C04 \|

> L12: \| `tests/platform/openbao-smoke.sh` \| OpenBao CI + certificado de fixture \| Health/TLS, init/unseal e API de secretos \| **Unseal 1-of-1 é exclusivo de CI**, não exemplo de configuração produtiva \|

> L13: \| `tests/platform/platform-manager-keycloak-ci.mjs` \| Keycloak/realm de ensaio \| JWT assinado, audience e requests negativos \| Direct Access Grants apenas para clients descartáveis \|

> L32: `testId + owner + commit SHA + comando/run + ambiente + fixture + resultado PASS/FAIL/SKIP/BLOCKED + negativos + limitações`. Se o teste depende de Keycloak/OpenFGA/PG reais, registrar se os containers eram descartáveis, assim como imagem e versão. **Não publicar a URI completa com credencial, bearer ou secret nos registros públicos.**

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L30: \| Integração de identidade \| Keycloak, OpenFGA, OpenBao, JWT/Host \| Containers CI, realms/stores e secrets de fixture \| Grants, tokens e DNS da operação \|

> L37: `Control Plane` mantém registry, roles e escopo global; cada `tenant database` é isolado. Os testes de PostgreSQL exercitam proibição de conexões indevidas e provisionamento de fixture, mas não criam dados permanentes da Q01. Os testes de OpenFGA validam grants simulados de A/B; os de Keycloak usam identidades descartáveis. **Q01 não cria database, tabela nem migration próprias.**

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
