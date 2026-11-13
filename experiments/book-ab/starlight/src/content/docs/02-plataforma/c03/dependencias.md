---
title: "C03 · Dependências e integrações"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dependências e integrações

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/STATUS.md)

> L10: \| Implementação \| Keycloak Compose `26.8.1`; PKCE S256 em Manager/Workspace; validação RS256 por JWKS no Manager, Account e Core Host \| Fonte no Git não comprova configuração do realm existente \|

> L11: \| Integração \| Testes unitários com JWKS e tokens assinados; CI Keycloak descartável com testes negativos `aud`/`azp` \| Sem fluxo navegador + Keycloak + Control/tenant real homologado nesta revisão \|

> L12: \| Operação \| Container `syndes-security-access-keycloak-1` observado **Up** no DevServer01 em 13/11 \| Estado do container não comprova readiness, HTTPS público, client, realm ou login funcional \|

> L18: - **C03 / Keycloak:** autentica identidades OIDC; banco técnico `syndes_keycloak` (não é o banco Control nem de tenants).

> L22: - **A06 / Account API:** `createTokenVerifier` devolve actor e recusa client Master; autorização de papéis de Account ocorre no OpenFGA, **não no Keycloak**.

> L24: - **C04 / OpenFGA e C01 / Control:** autorização, membership e grants separados da autenticação. Token válido não basta para acessar dados.

> L28: 1. **P0 — configuração real não reconciliada:** Compose e testes descrevem o esperado, mas não foram lidos de forma autenticada os clients, audiences, redirects, realm e mapper efetivos do Keycloak do DevServer01.

> L32: 5. **P1 — operação de identidade:** faltam evidências de health OIDC real, rotação/expiração de chaves, sessão/logout, revogação, backup/restore Keycloak e resposta a incidentes.

> L42: \| C03.OPS.01 \| **PENDENTE** \| Runbook Keycloak, saúde, atualização, rotação, backup/restore e rollback testados \|

> L44: - **13/11/2026:** inspecionados arquivos versionados e estado limitado do container Keycloak, sem dados privados. Testes de documentação/contrato são evidência da revisão, **não** Product Gate.

> L45: - **Próxima unidade documental:** C04 — Authorization OpenFGA, após registrar C03 com suas lacunas.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/REFERENCIA-TECNICA.md)

> L9: \| Keycloak 26.8.1 \| `infra/security-access/compose.yaml` \| Identity provider OIDC; imagem pinada e serviço em redes privadas; configuração via secret montado \|

> L11: \| OpenBao \| `infra/security-access/openbao/render_runtime.py`, `openbao/policies/keycloak.hcl` \| Entrega de configuração runtime; segredos não são definidos pela documentação \|

> L15: \| Account API (A06) \| `apps/account-access-api/src/auth.mjs`, `src/main.mjs` \| JWT RS256, client separado e autorização OpenFGA para delegação \|

> L16: \| Core Host (A04) \| `apps/core-host/src/adapters.ts`, `src/main.ts` \| `ActorVerifier`, membership Control e OpenFGA em gates distintos \|

> L51: - Endpoints de frontend `GET /master-runtime.json`, `GET /workspace-runtime.json` são configuração da respectiva UI, **não APIs Keycloak**.

> L57: - Keycloak: `KEYCLOAK_PUBLIC_URL`, secret montado como `keycloak.conf`, `KC_DB`, `KC_DB_URL`, `KC_DB_USERNAME`, `KC_HOSTNAME`, `KC_HEALTH_ENABLED`, `KC_METRICS_ENABLED` (fonte Compose).

> L66: - Keycloak e Control são fronteiras distintas; o `sub` do token referencia identidade, enquanto `tenant_memberships` e `platform_operator_access` são tratados por C01.

> L67: - `docker ps` em DevServer01 no dia 13/11 mostrou o container Keycloak **Up**, com imagem declarada `26.8.1`. Nenhum `docker exec`, consulta de realm, token, healthcheck ou mudança de configuração foi feito.

> L69: - Scripts de homologação: `infra/master-admin/keycloak-homolog.py` (`--check`, `--apply`, `--rollback`) e `keycloak-redirect-migrate.py` (migração auditada de redirect). **Não executados**.

> L76: \| `apps/account-access-api/test/auth.test.mjs` \| Token RS256 e check OpenFGA em teste \| Grants FGA implantados \|

> L78: \| `tests/platform/platform-manager-keycloak-ci.mjs` \| Realm Keycloak descartável, JWT assinado, client adversarial, 401/403 \| Client/roles de Keycloak no DevServer01 \|

> L79: \| `tests/platform/test-manager-keycloak-redirect.py` \| Restrições estáticas do migrador e registros de auditoria \| Migração de redirect aplicada neste trabalho \|

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/OPERACAO.md)

> L3: > **NÃO É RUNBOOK HOMOLOGADO.** Auditoria somente leitura em 13/11/2026. Não autoriza editar realm, clients, redirects, Keycloak, banco, token, OpenBao nem reiniciar serviços.

> L7: - DevServer01: Keycloak `26.8.1` identificado como container **Up**. Imagem/versionamento seguem `infra/security-access/compose.yaml`, mas **não** foi executado teste HTTP OIDC, login de navegador ou consulta autenticada ao realm.

> L8: - Segurança: `openbao` oferece secret config em runtime, sem publicar valores. O Keycloak declara banco técnico próprio. O Compose não é atestado de configuração do deploy.

> L17: 5. Associar provas por SHA + ambiente, owner e decisão de segurança antes de alterar status para integração validada ou homologação.

> L21: - `infra/master-admin/keycloak-homolog.py`: `--check` é modo de inspeção; `--apply` cria/ajusta client conforme script e `--rollback` usa registro privado. Exigem operador autorizado e análise de risco.

> L22: - `infra/master-admin/keycloak-redirect-migrate.py`: operação de redirect com `--apply`/`--rollback`; não invocar sem janela, origem correta e rollback aprovado.

> L23: - Não ativar Direct Access Grants no client de browser real; a suíte `platform-manager-keycloak-ci.mjs` os habilita apenas em **realm descartável**.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/chapters/04-contratos-e-dependencias-publicas.md)

> L3: **Contrato externo do C03:** OIDC do Keycloak (Authorization Code, token, JWKS e discovery). O provedor não publica API de negócio Syndes. URI exata/realm live **não auditados**.

> L5: \| Consumidor \| Contrato \| Dependência e negativa de acesso \|

> L10: \| Account API A06 \| `createTokenVerifier` \| audience/client dedicado; decisão de escrita no OpenFGA \|

> L15: **Eventos:** não foi identificado contrato de evento de domínio próprio do C03 em `infra/security-access`. Eventos tenant em C06 e trilhas de autorização pertencem a outros owners; não inventar publisher/consumer Keycloak.

> L17: **Public/private:** métodos de clientes OIDC nos frontends e verificadores de APIs são implementação interna dos respectivos pacotes, **não SDK público C03**. OpenBao/Keycloak admin secrets, arquivo renderizado e política de provisionamento são contratos privados de operação.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L20: - `infra/security-access/compose.yaml`: serviço Keycloak `26.8.1`, `KC_DB=postgres`, nome técnico do banco `syndes_keycloak`, configuração `keycloak.conf` montada em secret, redes declaradas de dados, autenticação, segredos e identidade Manager.

> L22: - O container Keycloak estava Up no DevServer01 (13/11); publicação somente loopback foi observada no runtime, enquanto o Compose base não publica porta. **Overrides, endpoints públicos, configuração de realm e health OIDC não verificados**.

> L30: - Keycloak/secret: `KEYCLOAK_PUBLIC_URL`, `KC_HOSTNAME`, `KC_DB_URL`, `KC_DB_USERNAME`; **nenhum valor, URL interna ou segredo** deve ser exposto nesta página.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
