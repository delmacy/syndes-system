---
title: "C03 · Configuração e ambiente"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Configuração e ambiente

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/STATUS.md)

> L10: \| Implementação \| Keycloak Compose `26.8.1`; PKCE S256 em Manager/Workspace; validação RS256 por JWKS no Manager, Account e Core Host \| Fonte no Git não comprova configuração do realm existente \|

> L19: - **A02 / Manager Web:** `readConfig`, `login`, `finishLogin` e `clearLogin` usando Authorization Code + PKCE; configuração de runtime própria.

> L28: 1. **P0 — configuração real não reconciliada:** Compose e testes descrevem o esperado, mas não foram lidos de forma autenticada os clients, audiences, redirects, realm e mapper efetivos do Keycloak do DevServer01.

> L31: 4. **P1 — configuração versus runtime:** o Compose define ausência de porta pública; a instância observada tem binding local de loopback. Inventariar overrides e origem de exposição HTTPS sem publicar topologia sensível.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/REFERENCIA-TECNICA.md)

> L9: \| Keycloak 26.8.1 \| `infra/security-access/compose.yaml` \| Identity provider OIDC; imagem pinada e serviço em redes privadas; configuração via secret montado \|

> L10: \| PostgreSQL \| `infra/security-access/compose.yaml`, `infra/postgres/compose.yaml` \| Banco técnico declarado `syndes_keycloak`; **não** `syndes_control` nem dados dos tenants \|

> L11: \| OpenBao \| `infra/security-access/openbao/render_runtime.py`, `openbao/policies/keycloak.hcl` \| Entrega de configuração runtime; segredos não são definidos pela documentação \|

> L51: - Endpoints de frontend `GET /master-runtime.json`, `GET /workspace-runtime.json` são configuração da respectiva UI, **não APIs Keycloak**.

> L57: - Keycloak: `KEYCLOAK_PUBLIC_URL`, secret montado como `keycloak.conf`, `KC_DB`, `KC_DB_URL`, `KC_DB_USERNAME`, `KC_HOSTNAME`, `KC_HEALTH_ENABLED`, `KC_METRICS_ENABLED` (fonte Compose).

> L61: - Variáveis são **nomes versionados**, não prova de valores corretos em ambiente; não registrar client secrets, bearer, URL interna completa ou credenciais nesta página.

> L65: - `syndes_keycloak` é a base técnica declarada pelo Compose; **C03 não possui migrations SQL de tenant ou Control** em `infra/security-access`.

> L67: - `docker ps` em DevServer01 no dia 13/11 mostrou o container Keycloak **Up**, com imagem declarada `26.8.1`. Nenhum `docker exec`, consulta de realm, token, healthcheck ou mudança de configuração foi feito.

> L68: - O Compose comenta que não expõe porta de host; uma publicação **somente em loopback** foi observada no container implantado. Isso exige reconciliação dos overrides/deploy, mas não demonstra acesso público.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/OPERACAO.md)

> L7: - DevServer01: Keycloak `26.8.1` identificado como container **Up**. Imagem/versionamento seguem `infra/security-access/compose.yaml`, mas **não** foi executado teste HTTP OIDC, login de navegador ou consulta autenticada ao realm.

> L8: - Segurança: `openbao` oferece secret config em runtime, sem publicar valores. O Keycloak declara banco técnico próprio. O Compose não é atestado de configuração do deploy.

> L13: 1. Identificar versão/digest da imagem em uso, overrides do Compose, origem HTTPS, issuer e cadeia de certificados; reunir **metadados sem segredos**.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L20: - `infra/security-access/compose.yaml`: serviço Keycloak `26.8.1`, `KC_DB=postgres`, nome técnico do banco `syndes_keycloak`, configuração `keycloak.conf` montada em secret, redes declaradas de dados, autenticação, segredos e identidade Manager.

> L22: - O container Keycloak estava Up no DevServer01 (13/11); publicação somente loopback foi observada no runtime, enquanto o Compose base não publica porta. **Overrides, endpoints públicos, configuração de realm e health OIDC não verificados**.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
