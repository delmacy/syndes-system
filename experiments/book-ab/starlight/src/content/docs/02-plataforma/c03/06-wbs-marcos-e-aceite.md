---
title: "C03 · WBS e critérios de aceite"
description: "Volume Plataforma e core · capítulo C03 · matéria 06"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/chapters/06-wbs-marcos-e-aceite.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 6. WBS, marcos e aceite

| Marco | Responsável / dependência | Saída verificável | Status |
|---|---|---|---|
| C03.DOC.01 | Documentação/owner C03 | Capabilities, contratos, testes, stack e riscos referenciados por arquivo | Auditoria parcial |
| C03.SEC.01 | C03 + segurança + operador Keycloak | Snapshot seguro read-only de realm, clients, redirects, mappers e flags efetivos | Pendente |
| C03.SEC.02 | A01/A02/A04/A05/A06 + C01/C04 | Suite E2E negativa com tokens reais de homologação e grants reais tenant A/B | Pendente |
| C03.OPS.01 | Infra/Segurança | Health, rotação/JWKS, sessões, logs higienizados, backup/restore e rollback demonstrados | Pendente |
| C03.GATE | Produto/Segurança/Operação | Revisão de cliente e domínio, teste HTTPS, isolamento, sign-off por SHA/ambiente | Bloqueado |

**Evidência já existente:** testes unitários JWT/PKCE e `tests/platform/platform-manager-keycloak-ci.mjs` com Keycloak descartável; CI geral aprovada no SHA `ac8deb8`. Não reutilizar o status CI como certificação dos clients/realm persistentes.

**Sequência adequada:** homologar configuração atual sem escrita → testar negativas por client, issuer e grant → validar recuperação/rotação e exposição HTTPS → obter aceite → só então qualquer ajuste operacional distinto.

**Próxima auditoria documental da lista de 57 unidades:** C04 — Authorization OpenFGA; não antecipar sua implementação para fechar a documentação C03.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/chapters/06-wbs-marcos-e-aceite.md).
