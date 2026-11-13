---
title: "C03 · Testes e evidências"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Testes e evidências

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/STATUS.md)

> L7: \| Eixo \| Evidência confirmada \| Limite \|

> L9: \| Documentação \| **Auditoria parcial**: fontes, consumidores OIDC, métodos, fluxos, rede, testes e lacunas mapeados \| Revisão e aprovação do owner pendentes \|

> L11: \| Integração \| Testes unitários com JWKS e tokens assinados; CI Keycloak descartável com testes negativos `aud`/`azp` \| Sem fluxo navegador + Keycloak + Control/tenant real homologado nesta revisão \|

> L14: \| Product Gate \| **Não aprovado** \| Sem teste E2E A/B, grants reais, recuperação/rotação ou homologação de produção \|

> L21: - **A05 / Manager API:** `createMasterTokenVerifier` exige assinatura RS256, issuer HTTPS, audience e client `azp`; `platform_operator_access` é gate independente.

> L28: 1. **P0 — configuração real não reconciliada:** Compose e testes descrevem o esperado, mas não foram lidos de forma autenticada os clients, audiences, redirects, realm e mapper efetivos do Keycloak do DevServer01.

> L29: 2. **P0 — isolamento entre aplicações requer E2E negativo:** provar token Manager→Workspace negado, Workspace→Manager negado e sujeito sem grant→403 com dados A/B reais; a CI sintética não fecha esse gate.

> L32: 5. **P1 — operação de identidade:** faltam evidências de health OIDC real, rotação/expiração de chaves, sessão/logout, revogação, backup/restore Keycloak e resposta a incidentes.

> L39: \| C03.DOC.01 \| **AUDITORIA PARCIAL** \| Owner revisar matriz e evidências \|

> L44: - **13/11/2026:** inspecionados arquivos versionados e estado limitado do container Keycloak, sem dados privados. Testes de documentação/contrato são evidência da revisão, **não** Product Gate.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/REFERENCIA-TECNICA.md)

> L16: \| Core Host (A04) \| `apps/core-host/src/adapters.ts`, `src/main.ts` \| `ActorVerifier`, membership Control e OpenFGA em gates distintos \|

> L28: \| A01 \| `actorFromToken(token)` \| Apenas decodifica `sub` para UI, **não verifica assinatura** e **não é gate de backend** \|

> L76: \| `apps/account-access-api/test/auth.test.mjs` \| Token RS256 e check OpenFGA em teste \| Grants FGA implantados \|

> L81: **Gates em aberto:** verificar realm/clients/mappers/redirects efetivos sem divulgar PII; provar navegação, renovação/revogação, negativas cruzadas reais e recuperação; revisar rotas que usam `verify` genérico versus `verifyClient` específico.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/OPERACAO.md)

> L7: - DevServer01: Keycloak `26.8.1` identificado como container **Up**. Imagem/versionamento seguem `infra/security-access/compose.yaml`, mas **não** foi executado teste HTTP OIDC, login de navegador ou consulta autenticada ao realm.

> L15: 3. Executar testes negativos usando identidades de teste autorizadas: Manager→tenant 401/403, Workspace→Manager 401, `iss`/`aud`/`azp` inválidos e `sub` sem grant no Control/FGA.

> L30: **Próximo gate:** C03.SEC.01 + C03.SEC.02, com revisão cruzada de C01 Control, C04 FGA, A04 Core Host, A05 Manager, A06 Account e A01/A02 frontends. Nenhuma alteração de infraestrutura foi executada.

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/chapters/06-wbs-marcos-e-aceite.md)

> L5: \| C03.DOC.01 \| Documentação/owner C03 \| Capabilities, contratos, testes, stack e riscos referenciados por arquivo \| Auditoria parcial \|

> L9: \| C03.GATE \| Produto/Segurança/Operação \| Revisão de cliente e domínio, teste HTTPS, isolamento, sign-off por SHA/ambiente \| Bloqueado \|

> L11: **Evidência já existente:** testes unitários JWT/PKCE e `tests/platform/platform-manager-keycloak-ci.mjs` com Keycloak descartável; CI geral aprovada no SHA `ac8deb8`. Não reutilizar o status CI como certificação dos clients/realm persistentes.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
