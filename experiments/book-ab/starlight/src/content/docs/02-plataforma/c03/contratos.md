---
title: "C03 · Contratos públicos e privados"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Contratos públicos e privados

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/STATUS.md)

> L12: \| Operação \| Container `syndes-security-access-keycloak-1` observado **Up** no DevServer01 em 13/11 \| Estado do container não comprova readiness, HTTPS público, client, realm ou login funcional \|

> L20: - **A01 / Workspace Web:** `getWorkspaceConfig`, `beginLogin`, `finishLogin`, `markSignedOut`; client público separado e callback validado por `state`.

> L31: 4. **P1 — configuração versus runtime:** o Compose define ausência de porta pública; a instância observada tem binding local de loopback. Inventariar overrides e origem de exposição HTTPS sem publicar topologia sensível.

> L44: - **13/11/2026:** inspecionados arquivos versionados e estado limitado do container Keycloak, sem dados privados. Testes de documentação/contrato são evidência da revisão, **não** Product Gate.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/REFERENCIA-TECNICA.md)

> L3: > **AUDITORIA ESTÁTICA E INSPEÇÃO OPERACIONAL LIMITADA — 13/11/2026.** Baseline `origin/main` `ac8deb8`. O catálogo atribui C03 a `infra/security-access`, maturity `distributed` (metadado de inventário). Nenhuma consulta ao Admin API, segredo ou conteúdo de usuários. Portanto, os contratos abaixo são **declarados no código**; seus parâmetros reais de implantação não foram homologados.

> L7: \| Componente \| Fonte \| Contrato / limite \|

> L31: \| A04 \| `ActorVerifier.verifyToken(header,clientId?)` \| Implementação **private** compartilhada por `verify` e `verifyClient`; não constitui API pública da plataforma \|

> L68: - O Compose comenta que não expõe porta de host; uma publicação **somente em loopback** foi observada no container implantado. Isso exige reconciliação dos overrides/deploy, mas não demonstra acesso público.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/OPERACAO.md)

> L21: - `infra/master-admin/keycloak-homolog.py`: `--check` é modo de inspeção; `--apply` cria/ajusta client conforme script e `--rollback` usa registro privado. Exigem operador autorizado e análise de risco.

> L24: - Não copiar tokens, senhas, secret files nem detalhes de topologia privada para esta documentação.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/chapters/04-contratos-e-dependencias-publicas.md)

> L3: **Contrato externo do C03:** OIDC do Keycloak (Authorization Code, token, JWKS e discovery). O provedor não publica API de negócio Syndes. URI exata/realm live **não auditados**.

> L5: \| Consumidor \| Contrato \| Dependência e negativa de acesso \|

> L15: **Eventos:** não foi identificado contrato de evento de domínio próprio do C03 em `infra/security-access`. Eventos tenant em C06 e trilhas de autorização pertencem a outros owners; não inventar publisher/consumer Keycloak.

> L17: **Public/private:** métodos de clientes OIDC nos frontends e verificadores de APIs são implementação interna dos respectivos pacotes, **não SDK público C03**. OpenBao/Keycloak admin secrets, arquivo renderizado e política de provisionamento são contratos privados de operação.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
