---
title: "C05 · Dependências e integrações"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dependências e integrações

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 13/11/2026.** Baseline `e86beda`; fontes Git e observação **somente leitura** do container no DevServer01. Container `syndes-security-access-openbao-1` observado **Up** (imagem `openbao/openbao:2.7.0`). Nenhum token, segredo, política ativa, conteúdo KV, seal/unseal ou endpoint administrativo foi consultado. Estado operacional e produção **NÃO HOMOLOGADOS**.

> L13: \| Policies \| `policies/{core-host,core-tenant-db,keycloak,openfga,runtime-delivery}.hcl` declaradas \| Templates no Git **não comprovam políticas ativas** \|

> L14: \| Testes \| `apps/core-host/test/secrets.test.mjs` e script `tests/platform/openbao-smoke.sh` \| Smoke é teste **descartável**; não foi executado contra o OpenBao atual \|

> L20: - Os renderers podem produzir configurações para PostgreSQL/Keycloak/OpenFGA; **a existência do código de renderer não significa que todos os consumidores já migraram**, estejam configurados ou tenham retirado seus dados da distribuição por ambiente.

> L21: - `infra/security-access/openbao/README.md` descreve limitações explícitas de migração; reconciliar Compose e runtime-alvo antes de publicar estado final.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/REFERENCIA-TECNICA.md)

> L3: > **AUDITORIA ESTÁTICA + CONTAINER UP — 13/11/2026.** Baseline `e86beda`; não houve requisições ao OpenBao, leitura de KV, comandos administrativos ou dump de arquivos runtime. Código versionado não significa configuração em operação.

> L9: \| C05 — servidor \| `infra/security-access/compose.yaml`, `infra/security-access/openbao/config.hcl` \| OpenBao `openbao/openbao:2.7.0`, HTTPS, rede `syndes-secrets`, volume `openbao_raft`; não é banco Tenant/Control \|

> L10: \| C05 — políticas candidatas \| `infra/security-access/openbao/policies/*.hcl` \| Templates declarativos para `core-host`, `core-tenant-db`, `keycloak`, `openfga`, `runtime-delivery`; não comprovam instalação \|

> L11: \| C05 — renderer \| `infra/security-access/openbao/render_runtime.py`, `run-renderer.sh` \| AppRole → KV v2 → arquivo de runtime em diretório protegido → revoke-self \|

> L13: \| Manager / operação \| `infra/master-admin/openbao/{render-master.py,operator-provision.py,run-renderer.sh}` \| Operador e renderer próprios; revisão operacional e autorizações separadas \|

> L19: \| C05 \| `render_runtime.main` (`render_runtime.py`) \| Verifica URL fixa, diretório protegido e CA; autentica AppRole e lê KV de `postgres`, `keycloak`, `openfga`; gera arquivos via `mkstemp` + `os.replace`; tenta revogar token \|

> L26: **Notas:** O Core Host tenta revogar o token inclusive após erro no read. Revogação malsucedida bloqueia startup. Este comportamento está em `secrets.test.mjs` com fetch mockado; nenhuma prova de token revogado em ambiente real foi obtida. `render_runtime.py` tem garantia de falha por exceção para requests, mas a revogação é um gate operacional a observar em integração.

> L42: A conexão apresentada é **arquitetura declarada e/ou caminho no código**, não topologia implantada comprovada. Nenhuma UI própria pertence ao C05. O cofre não define entidades CRM/Inbox, eventos de negócio nem migrations Tenant DB. `openbao_raft` é persistência interna do serviço OpenBao, sem inferir PostgreSQL separado.

> L47: - `tests/platform/openbao-smoke.sh`: define ensaio descartável com TLS, inicialização/unseal, Raft, AppRole, policies e renderer; **não executar no ambiente com segredos reais**.

> L48: - `infra/security-access/openbao/README.md`: runbook de preparação/DR, com limites explícitos da migração. A checagem só de conteúdo documental não implica resultado de CI ou teste in-memory.

> L50: **Não homologado:** integração real em DevServer01, CA/SAN instalado, políticas/identidades efetivas, seal state, auditoria OpenBao, snapshots testados, rotação e consumers totalmente migrados.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/OPERACAO.md)

> L10: 4. Separar os consumers efetivamente migrados (Core Host, Manager, PostgreSQL, Keycloak, OpenFGA) por ambiente; não extrapolar do código/README. Testar restart/reload, rotação e fallback recusado.

> L16: - Nunca utilizar o smoke descartável `tests/platform/openbao-smoke.sh` contra volume real: o script inicializa um cofre de teste e usa identidade descartável.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/chapters/04-contratos-e-dependencias-publicas.md)

> L3: - OpenBao API usada pelo Core Host: `POST /v1/auth/approle/login`, `GET /v1/kv/data/production/core-host`, `POST /v1/auth/token/revoke-self`. `loadCoreSecrets` retorna `controlDbUrl` e `openfgaToken` internamente ao A04; valores nunca devem ser documentados.

> L4: - Renderer C05 `render_runtime.main`: AppRole de provisionamento, KV `postgres/keycloak/openfga` e saída de arquivos protected tmpfs; não é HTTP endpoint SaaS.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L16: **Migração:** renderer suporta arquivos de outros serviços, mas isso sozinho não atesta migração final de Keycloak/OpenFGA/PostgreSQL.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
