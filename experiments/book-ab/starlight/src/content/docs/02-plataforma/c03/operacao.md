---
title: "C03 · Operação e implantação"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Operação e implantação

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/STATUS.md)

> L12: \| Operação \| Container `syndes-security-access-keycloak-1` observado **Up** no DevServer01 em 13/11 \| Estado do container não comprova readiness, HTTPS público, client, realm ou login funcional \|

> L32: 5. **P1 — operação de identidade:** faltam evidências de health OIDC real, rotação/expiração de chaves, sessão/logout, revogação, backup/restore Keycloak e resposta a incidentes.

> L33: 6. **P1 — clients mutáveis:** scripts de homologação e migração de redirect possuem modos de escrita; nenhuma aplicação ou rollback está autorizada por esta auditoria.

> L42: \| C03.OPS.01 \| **PENDENTE** \| Runbook Keycloak, saúde, atualização, rotação, backup/restore e rollback testados \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/REFERENCIA-TECNICA.md)

> L3: > **AUDITORIA ESTÁTICA E INSPEÇÃO OPERACIONAL LIMITADA — 13/11/2026.** Baseline `origin/main` `ac8deb8`. O catálogo atribui C03 a `infra/security-access`, maturity `distributed` (metadado de inventário). Nenhuma consulta ao Admin API, segredo ou conteúdo de usuários. Portanto, os contratos abaixo são **declarados no código**; seus parâmetros reais de implantação não foram homologados.

> L68: - O Compose comenta que não expõe porta de host; uma publicação **somente em loopback** foi observada no container implantado. Isso exige reconciliação dos overrides/deploy, mas não demonstra acesso público.

> L69: - Scripts de homologação: `infra/master-admin/keycloak-homolog.py` (`--check`, `--apply`, `--rollback`) e `keycloak-redirect-migrate.py` (migração auditada de redirect). **Não executados**.

> L76: \| `apps/account-access-api/test/auth.test.mjs` \| Token RS256 e check OpenFGA em teste \| Grants FGA implantados \|

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/OPERACAO.md)

> L8: - Segurança: `openbao` oferece secret config em runtime, sem publicar valores. O Keycloak declara banco técnico próprio. O Compose não é atestado de configuração do deploy.

> L16: 4. Comprovar health, logs higienizados, chaves JWKS/rotação, políticas de sessão/logout, desativação de usuário, reset, recuperação, backup/restore e rollback de client.

> L21: - `infra/master-admin/keycloak-homolog.py`: `--check` é modo de inspeção; `--apply` cria/ajusta client conforme script e `--rollback` usa registro privado. Exigem operador autorizado e análise de risco.

> L22: - `infra/master-admin/keycloak-redirect-migrate.py`: operação de redirect com `--apply`/`--rollback`; não invocar sem janela, origem correta e rollback aprovado.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/chapters/06-wbs-marcos-e-aceite.md)

> L8: \| C03.OPS.01 \| Infra/Segurança \| Health, rotação/JWKS, sessões, logs higienizados, backup/restore e rollback demonstrados \| Pendente \|

> L9: \| C03.GATE \| Produto/Segurança/Operação \| Revisão de cliente e domínio, teste HTTPS, isolamento, sign-off por SHA/ambiente \| Bloqueado \|

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
