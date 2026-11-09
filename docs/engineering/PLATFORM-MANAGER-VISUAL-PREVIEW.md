# Platform Manager visual preview — independent, no login

The user needs to inspect the existing Manager UI now, while the Manager API and first-owner credential gate are still pending. The normal build remains protected by Keycloak. A **separate build** using `npm run build:visual-preview` compiles the same existing React views with a constant `VITE_DEMO_PREVIEW=true` for an exclusively visual artifact.

- `apps/master-admin-web/src/demo.ts` implements the exact read-only MasterApi interface without HTTP requests using three explicitly named **[DEMONSTRAÇÃO]** tenants, invented IDs and immutable summary values.
- `App.tsx` skips Keycloak only for the dedicated visual build, visibly labels the data as fictitious at all times, and retains the already planned menu items (Visão geral, Clientes), searches, status filters, drawers and no mutation buttons. Regular `npm run build` is unchanged: requires OIDC + owner/operator/viewer authorization.
- The visual artifact is *never* an authenticated manager and *never* loads real tenant metadata. Production API paths must return 503/404 at the web server. Deploy only on Tailnet-only HTTPS 9446; do not promote this image as the operational Manager.
- `node tests/visual-preview-e2e.mjs` tests an actual headless browser, no login, banner, menu, filtering, details, and **zero** requests to `/v1/` or Keycloak.
- For release, preserve real OIDC, operator grant, API and Control DB checks as prerequisites; no automatic bypass in normal deployment. The preview may be replaced when a real Manager is ready, never automatically connected to API with this demo build.
