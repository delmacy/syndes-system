---
title: "C05 · APIs e endpoints"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# APIs e endpoints

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 13/11/2026.** Baseline `e86beda`; fontes Git e observação **somente leitura** do container no DevServer01. Container `syndes-security-access-openbao-1` observado **Up** (imagem `openbao/openbao:2.7.0`). Nenhum token, segredo, política ativa, conteúdo KV, seal/unseal ou endpoint administrativo foi consultado. Estado operacional e produção **NÃO HOMOLOGADOS**.

> L19: - **C05** é infraestrutura de segredos. **A04 Core Host** é proprietário de `loadCoreSecrets`; **Manager** tem renderer e operador próprios. Não promover implementações de consumers como API pública de C05.

> L35: **Próxima unidade de documentação:** A06 — Account Access API.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/REFERENCIA-TECNICA.md)

> L21: \| A04 \| `loadCoreSecrets` (`secrets.ts`) \| Lê `roleIdFile`/`secretIdFile`; `POST /v1/auth/approle/login`, `GET /v1/kv/data/production/core-host`, `POST /v1/auth/token/revoke-self`; requer `control_db_url` e `openfga_token` \|

> L23: \| Manager \| `render-master.main` \| Renderer de runtime Manager em owner infra/master-admin; não é API C05 \|

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/chapters/04-contratos-e-dependencias-publicas.md)

> L3: - OpenBao API usada pelo Core Host: `POST /v1/auth/approle/login`, `GET /v1/kv/data/production/core-host`, `POST /v1/auth/token/revoke-self`. `loadCoreSecrets` retorna `controlDbUrl` e `openfgaToken` internamente ao A04; valores nunca devem ser documentados.

> L4: - Renderer C05 `render_runtime.main`: AppRole de provisionamento, KV `postgres/keycloak/openfga` e saída de arquivos protected tmpfs; não é HTTP endpoint SaaS.

> L7: - O C05 não publica evento de negócio ou API frontend. Contratos de auth/authorizer ficam em C03/C04/A04.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
