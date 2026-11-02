# DevServer01 — WhatsApp gateway
This compose adds the Go/whatsmeow gateway to the existing external syndes-data network. No public gateway port.
Before boot:
1. Configure WHATSAPP_STORE_DSN to the dedicated PostgreSQL database used by the gateway. The database must exist; credentials need DDL to initialize Whatsmeow and its queues.
2. Configure separate high-entropy WHATSAPP_WHATSMEOW_TOKEN and WHATSAPP_WEBHOOK_TOKEN in the *gateway and Core Host deployments*. Keep secrets outside git and browser configuration.
3. Rebuild/redeploy Core Host with the WhatsApp module plugin installed and migrations 001 and 002 applied to each enabled tenant DB; turn on WHATSAPP_DISPATCH_ENABLED only after confirming the receiver exists.
4. Confirm core-host and whatsapp-gateway resolve one another on syndes-data.
5. Run: docker compose -f modules/whatsapp/deploy/compose.yaml config (with env configured), then docker compose -f modules/whatsapp/deploy/compose.yaml up -d --build.
6. Pair a dedicated test number in Workspace > Settings > WhatsApp numbers, inspect the inbound event storage and Inbox, verify disconnect and reconnect.
A Go test suite and a web build do NOT substitute for container startup/QR/live-message acceptance.

## Reversible DevServer01 cutover (2026-11-02)
The existing protected Core Host and Workspace containers were not deleted or replaced. A separate Docker Compose stack is defined in `devserver01-cutover.compose.yaml` using the existing Core Host AppRole mounts through `volumes_from` and the new Workspace dist. Its Traefik router priority is higher than the old one, with the same tailnet-only middleware. The gateway uses `devserver01-callback.compose.yaml` to target the new Core Host, avoiding callbacks to the older image.

The `syndes-whatsapp-cutover` stack runs `syndes-core-host-whatsapp-v2` and `syndes-workspace-whatsapp-v2`. Gateway remains `syndes-whatsapp-whatsapp-gateway-1`. The secure canary env file remains under `~/.config/syndes-whatsapp/core-canary.env`, with permissions 0600. The tenant-bound OpenFGA `whatsapp:accounts` resource relationship was created through the authenticated API; it grants tenant roles according to the existing FGA model.

**Rollback (reversible):** stop the two `syndes-whatsapp-cutover` containers with `docker compose -p syndes-whatsapp-cutover -f modules/whatsapp/deploy/devserver01-cutover.compose.yaml stop`. The old routers and containers stay running and will serve users again. Before accepting WhatsApp traffic after rollback, re-point the gateway callback at a compatible Core Host or pause the gateway; the older Host does not accept versioned WhatsApp callbacks. Never delete the original containers or Compose overlays during this temporary cutover.

**Snapshots:** `/home/delmacy/syndes-snapshots/2026-11-02-whatsapp-pre-cutover` has the old Core Host image tag `syndes/core-host:pre-whatsapp-snapshot-20261102`, old workspace image tag `syndes/workspace:pre-whatsapp-snapshot-20261102`, container inspection metadata, static workspace files, and two screenshot previews. Screenshots use *simulated* number and QR data, not a paired WhatsApp number.

**Acceptance remaining:** an authorized user must open CRM > Gerenciar números WhatsApp, create an account, scan a live QR code and send a real test message before end-to-end messaging and message replies are marked validated. The inbox fallback refresh can take up to ten seconds. Do not claim live-number pairing or two-way delivery without this test.
