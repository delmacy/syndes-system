## 0. Endereços exatos de leitura

| Assunto | Fonte do repositório |
|---|---|
| Catálogo e maturity | `catalog/work-units.json` (`C03`, `infra/security-access`, `distributed`) |
| Contrato Keycloak | `infra/security-access/compose.yaml` (serviço `keycloak`) |
| Segredos runtime | `infra/security-access/openbao/render_runtime.py`, `openbao/policies/keycloak.hcl` |
| Manager PKCE | `apps/master-admin-web/src/auth.ts` (A02) |
| Workspace PKCE | `apps/workspace-web/src/lib/auth.ts` (A01) |
| Manager JWT | `apps/master-admin-api/src/auth.mjs`, `src/main.mjs` (A05) |
| Account JWT | `apps/account-access-api/src/auth.mjs`, `src/main.mjs` (A06) |
| Core JWT, membership, FGA | `apps/core-host/src/adapters.ts`, `src/main.ts` (A04) |
| Homologação/redirect | `infra/master-admin/keycloak-homolog.py`, `keycloak-redirect-migrate.py` (owner de operação Manager) |
| CI e regressões | `tests/platform/platform-manager-keycloak-ci.mjs`, `test-manager-keycloak-redirect.py`, `apps/*/test/auth.test.mjs` |
| Padrão público | `docs/standards/CONTRATOS-PUBLICOS.md` |
| Status e evidências | `docs/subprojects/C03-identity-keycloak/STATUS.md`, `REFERENCIA-TECNICA.md`, `OPERACAO.md` |

**Baselines:** código `origin/main` `ac8deb8c538f59364c6247964a5b0d42e5fbae2e`; revisão após C01 `f64a38c`, em 13/11/2026. Nenhuma configuração de produção foi exportada.
