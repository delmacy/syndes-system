---
title: "C03 · Capacidades"
description: "Volume Plataforma e core · capítulo C03 · matéria 03"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/chapters/03-capabilities.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 3. Capabilities

| Capacidade | Evidência | Estado de comprovação |
|---|---|---|
| Identity provider OIDC | `infra/security-access/compose.yaml`, Keycloak `26.8.1` | Serviço versionado; container observado Up; login não comprovado |
| Authorization Code + PKCE S256 | `apps/master-admin-web/src/auth.ts`, `apps/workspace-web/src/lib/auth.ts` | Implementado nos frontends; cobertura unitária de Workspace |
| JWT RS256 e JWKS remoto | `apps/master-admin-api/src/auth.mjs`, `apps/account-access-api/src/auth.mjs`, `apps/core-host/src/adapters.ts` | Implementado em consumidores; testes unitários/integrados descartáveis |
| Audience e authorized party distintos | Verificadores de token e fixtures Keycloak de CI | Provado no teste descartável, não no realm real |
| Autorização contextual | Control `platform_operator_access`/membership + OpenFGA | **Owner externo C01/C04**; não declarar capability nativa do Keycloak |
| Configuração secreta | OpenBao renderer e `keycloak.conf` montado no Compose | Contrato de entrega; valores e rotação não auditados |
| Migração de redirect | `infra/master-admin/keycloak-redirect-migrate.py` | Script auditável; não executado nesta etapa |
| Backup, revogação, rotação, recovery | Sem evidência E2E operacional nesta auditoria | Pendente de runbook e Product Gate |

**Antirrequisito:** não ativar Direct Access Grants em clientes de navegador. As credenciais de teste usadas em CI pertencem exclusivamente ao realm **descartável**.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/chapters/03-capabilities.md).
