---
title: "C03 · APIs e endpoints"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# APIs e endpoints

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 13/11/2026.** Fonte de código: `origin/main` SHA `ac8deb8c538f59364c6247964a5b0d42e5fbae2e`; consolidação documental iniciada após C01 `f64a38c`. Observação **somente leitura** do DevServer01 (sem consulta de usuários, tokens, realm administrativo ou credenciais). Nenhum cliente OIDC, redirect, segredo, API, banco ou container foi alterado. Staging e produção **não verificados**.

> L21: - **A05 / Manager API:** `createMasterTokenVerifier` exige assinatura RS256, issuer HTTPS, audience e client `azp`; `platform_operator_access` é gate independente.

> L22: - **A06 / Account API:** `createTokenVerifier` devolve actor e recusa client Master; autorização de papéis de Account ocorre no OpenFGA, **não no Keycloak**.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/REFERENCIA-TECNICA.md)

> L3: > **AUDITORIA ESTÁTICA E INSPEÇÃO OPERACIONAL LIMITADA — 13/11/2026.** Baseline `origin/main` `ac8deb8`. O catálogo atribui C03 a `infra/security-access`, maturity `distributed` (metadado de inventário). Nenhuma consulta ao Admin API, segredo ou conteúdo de usuários. Portanto, os contratos abaixo são **declarados no código**; seus parâmetros reais de implantação não foram homologados.

> L14: \| Manager API (A05) \| `apps/master-admin-api/src/auth.mjs`, `src/main.mjs` \| JWT RS256 via `jose`, `iss` + `aud` + `azp` + `sub`; grant Control independente \|

> L15: \| Account API (A06) \| `apps/account-access-api/src/auth.mjs`, `src/main.mjs` \| JWT RS256, client separado e autorização OpenFGA para delegação \|

> L18: **C03 é infraestrutura declarativa, não um pacote NestJS ou API HTTP própria do repositório**: em `infra/security-access` não há `package.json` ou controller. Métodos listados pertencem aos **consumidores** acima.

> L24: \| A02 \| `readConfig()` \| Carrega `GET /master-runtime.json` (artefato do frontend), valida issuer HTTPS e client id \|

> L26: \| A01 \| `getWorkspaceConfig()` \| Carrega `GET /workspace-runtime.json`; exige issuer HTTPS, client id e tenant UUID \|

> L31: \| A04 \| `ActorVerifier.verifyToken(header,clientId?)` \| Implementação **private** compartilhada por `verify` e `verifyClient`; não constitui API pública da plataforma \|

> L50: - OIDC padrão do provedor: `GET /realms/{realm}/.well-known/openid-configuration`, endpoint de autorização, endpoint de token e JWKS. URLs do realm **não foram verificadas ao vivo**; não declarar disponibilidade apenas pela convenção.

> L51: - Endpoints de frontend `GET /master-runtime.json`, `GET /workspace-runtime.json` são configuração da respectiva UI, **não APIs Keycloak**.

> L52: - `GET /modules/:moduleId/config` pertence ao **A04 Core Host** e expõe metadados públicos OIDC de plugin instalado; não substitui o controle de autorização.

> L58: - Manager API: `MASTER_KEYCLOAK_ISSUER`, `MASTER_KEYCLOAK_AUDIENCE`, `MASTER_KEYCLOAK_CLIENT_ID`, `MASTER_KEYCLOAK_JWKS_URL`, `MASTER_PUBLIC_ORIGIN`.

> L59: - Account API: `ACCOUNT_OIDC_ISSUER`, `ACCOUNT_OIDC_AUDIENCE`, `ACCOUNT_OIDC_CLIENT_ID`, `ACCOUNT_OIDC_JWKS_URL`.

> L75: \| `apps/master-admin-api/test/auth.test.mjs` \| RS256 assinado, JWKS fake local, erros de `aud`/`azp`/`sub` \| Realm real e navegador \|

> L76: \| `apps/account-access-api/test/auth.test.mjs` \| Token RS256 e check OpenFGA em teste \| Grants FGA implantados \|

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/OPERACAO.md)

> L7: - DevServer01: Keycloak `26.8.1` identificado como container **Up**. Imagem/versionamento seguem `infra/security-access/compose.yaml`, mas **não** foi executado teste HTTP OIDC, login de navegador ou consulta autenticada ao realm.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/chapters/04-contratos-e-dependencias-publicas.md)

> L3: **Contrato externo do C03:** OIDC do Keycloak (Authorization Code, token, JWKS e discovery). O provedor não publica API de negócio Syndes. URI exata/realm live **não auditados**.

> L7: \| Manager Web A02 \| `login`, `finishLogin`, `/master-runtime.json`, endpoints padrão OIDC \| PKCE, `state`; qualquer callback fora da sessão é rejeitado \|

> L9: \| Manager API A05 \| `createMasterTokenVerifier` \| `iss`, `aud`, `azp`, `sub`, JWKS RS256; depois verifica operador no Control \|

> L10: \| Account API A06 \| `createTokenVerifier` \| audience/client dedicado; decisão de escrita no OpenFGA \|

> L19: **Versões:** não afirmar compatibilidade sem comparar manifests, realm/clients de homologação e testes da imagem implantada. C03 não possui API versionada NestJS no repositório.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L22: - O container Keycloak estava Up no DevServer01 (13/11); publicação somente loopback foi observada no runtime, enquanto o Compose base não publica porta. **Overrides, endpoints públicos, configuração de realm e health OIDC não verificados**.

> L27: - Manager API: `MASTER_KEYCLOAK_ISSUER`, `MASTER_KEYCLOAK_AUDIENCE`, `MASTER_KEYCLOAK_CLIENT_ID`, `MASTER_KEYCLOAK_JWKS_URL`.

> L29: - Account API: `ACCOUNT_OIDC_ISSUER`, `ACCOUNT_OIDC_AUDIENCE`, `ACCOUNT_OIDC_CLIENT_ID`, `ACCOUNT_OIDC_JWKS_URL`.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
