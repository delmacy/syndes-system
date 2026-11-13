## 4. Contratos e dependências públicas

- OpenBao API usada pelo Core Host: `POST /v1/auth/approle/login`, `GET /v1/kv/data/production/core-host`, `POST /v1/auth/token/revoke-self`. `loadCoreSecrets` retorna `controlDbUrl` e `openfgaToken` internamente ao A04; valores nunca devem ser documentados.
- Renderer C05 `render_runtime.main`: AppRole de provisionamento, KV `postgres/keycloak/openfga` e saída de arquivos protected tmpfs; não é HTTP endpoint SaaS.
- `openBaoSourceFromEnv`: seleção de URL e nomes de arquivos, não credenciais de app.
- Policies do C05 são templates declarativos, não autorização ativa. `operator-provision.main` pertence ao Manager.
- O C05 não publica evento de negócio ou API frontend. Contratos de auth/authorizer ficam em C03/C04/A04.
