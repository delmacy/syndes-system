# Platform Manager visual preview — independent, no login

The user needs to inspect the existing Manager UI now, while the Manager API and first-owner credential gate are still pending. The normal build remains protected by Keycloak. A **separate build** using `npm run build:visual-preview` compiles the same existing React views with a constant `VITE_DEMO_PREVIEW=true` for an exclusively visual artifact.

- `apps/master-admin-web/src/demo.ts` implements the exact read-only MasterApi interface without HTTP requests using three explicitly named **[DEMONSTRAÇÃO]** tenants, invented IDs and immutable summary values.
- `App.tsx` skips Keycloak only for the dedicated visual build, visibly labels the data as fictitious at all times, and retains the already planned menu items (Visão geral, Clientes), searches, status filters, drawers and no mutation buttons. Regular `npm run build` is unchanged: requires OIDC + owner/operator/viewer authorization.
- The visual artifact is *never* an authenticated manager and *never* loads real tenant metadata. Production API paths must return 503/404 at the web server. Deploy only on Tailnet-only HTTPS 9446; do not promote this image as the operational Manager.
- `node tests/visual-preview-e2e.mjs` tests an actual headless browser, no login, banner, menu, filtering, details, and **zero** requests to `/v1/` or Keycloak.
- For release, preserve real OIDC, operator grant, API and Control DB checks as prerequisites; no automatic bypass in normal deployment. The preview may be replaced when a real Manager is ready, never automatically connected to API with this demo build.

## Deploy verificado no DevServer01

Em 2026-11-09, o artefato de visual preview, compilado em `win1-server` com `npm run build:visual-preview`, foi transferido ao DevServer01 e validado por SHA-256 `9afff70868ce84513494dcf0b1eb2c459c280e51c05d313e1452cfa47a4ce689`. A imagem runtime `syndes/master-admin-web:visual-preview-6c6525b` está no contêiner independente `syndes-platform-manager-visual` (UID 101, filesystem de somente leitura, capacidades descartadas, bind `127.0.0.1:18086`). O Tailscale Serve HTTPS 9446 foi atualizado de forma controlada para a nova porta sem tocar nas demais 8443/9443/9444.

**Aceite no navegador remoto:** `VISUAL_PREVIEW_URL=https://delmacy-desktoppc.tayra-delta.ts.net:9446/ node tests/visual-preview-e2e.mjs` passou de `win1-server`, cobrindo entrada sem login, banner explícito de demonstração, menu existente, pesquisa, filtros, detalhes, e nenhuma requisição a Keycloak/`/v1/`.

O contêiner anterior `syndes-platform-manager-preview` foi parado e preservado como rollback. A documentação privada e scripts de rollback/stop com verificação de alvo Tailscale estão em `/home/delmacy/syndes-platform-manager-preview`. Não existe API administrativa real nesse deploy; `/v1/platform/admin/*` continua respondendo 503. Apenas dados fictícios e rotulados são mostrados.
