## 2. Requisitos, histórias e casos de uso

### Comportamentos comprovados por fonte (não equivalem a Product Gate)

| ID documental | Caso e critério observado | Fonte |
|---|---|---|
| C03-RF01 | Manager e Workspace iniciam Authorization Code com PKCE S256 e validam `state` na resposta | `apps/master-admin-web/src/auth.ts`; `apps/workspace-web/src/lib/auth.ts` |
| C03-RF02 | Manager API recusa token com `aud`, `azp`, `iss`, assinatura ou `sub` incompatíveis | `apps/master-admin-api/src/auth.mjs`; `test/auth.test.mjs` |
| C03-RF03 | Account API recusa client Manager e exige grant específico OpenFGA para delegação | `apps/account-access-api/src/auth.mjs`; `test/auth.test.mjs` |
| C03-RF04 | Core Host rejeita client Manager e pode exigir client `azp` exato por `verifyClient` | `apps/core-host/src/adapters.ts` |
| C03-RF05 | Token Master válido sem autorização de operador retorna 403 no teste de integração descartável | `tests/platform/platform-manager-keycloak-ci.mjs` |

### Histórias de uso e critérios que exigem aceite operacional

- **US-01 (Manager):** como operador autorizado, entrar no Manager exclusivamente com client Manager e ter acesso recusado sem registro de privilégio Control; provar em navegador e API reais.
- **US-02 (Workspace):** como usuário com membership de tenant, entrar no Workspace com client próprio; token Manager não pode entrar no backend tenant, mesmo se audiência for compartilhada por erro.
- **US-03 (administrador):** revisar, revogar e rotacionar configuração de client com auditoria, sem expor credenciais e com rollback comprovado.
- **US-04 (segurança):** testar sessão expirada, usuário revogado, redirect não permitido, issuer forjado, audience inadequada, JWKS indisponível e negativação cross-tenant.

**Critérios de aceite propostos, ainda não executados:** Auth N/N, autorização 401/403, PKCE, redirects exatos, revogação, rotação, integridade de HTTPS e segregação de clients no ambiente-alvo. Não classificar como requisitos adicionais implementados.
