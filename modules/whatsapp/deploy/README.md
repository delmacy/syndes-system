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

Operational note: the gateway attaches to both `syndes-data` (private PostgreSQL/Core Host) and `syndes-whatsapp-egress` (outbound internet for WhatsApp). Create the outbound network before deployment; do not publish port 19083. DevServer01 uses `/srv/syndes-lab/system` for the currently deployed Core Host Compose, so plan the Core Host image update against those live Compose overlays and existing secrets, not the development worktree alone.

## DevServer01 provisioned resources (2026-11-02)
- Database `syndes_whatsapp_gateway` and LOGIN role `syndes_whatsapp_gateway` created. The role's password was configured interactively by the operator, and authentication using the restricted local credential file was verified. Do not use the postgres superuser.
- Outbound network `syndes-whatsapp-egress` exists; `syndes-data` remains internal.
- Secret material was generated locally in `/home/delmacy/.config/syndes-whatsapp/` with restricted permissions. **Never commit, print, or copy these secret values into issue/PR logs**.
- On the authorized host, a human operator can use interactive PostgreSQL `\\password syndes_whatsapp_gateway` in `psql`; this avoids entering a password in shell history. Ensure the configured password and the gateway DSN match.
- The Core Host currently running on DevServer01 is the previous image. Updating it must preserve `/srv/syndes-lab/system` and its existing Compose overlays/secret mounts.
- Database credential provisioning, tenant WhatsApp SQL migrations, and gateway startup are completed. The gateway is currently running as `syndes-whatsapp-whatsapp-gateway-1` (HTTP 200 from Core Host on `/healthz`, authenticated tenant accounts endpoint 200; no accounts paired yet). The existing Core Host and frontend are still running their previous images; updating their protected Compose stacks remains pending. Pair a test number and verify WhatsApp-to-Inbox messages only after the new Core Host and workspace are deployed and FGA grants are confirmed.

## Live verification — 2026-11-02
- Reused the existing `syndes-postgres-postgres-1` instance; no additional PostgreSQL server/container.
- Verified login as `syndes_whatsapp_gateway` to `syndes_whatsapp_gateway` using the pre-existing local credential file, without logging its contents.
- Applied WhatsApp migrations `001_whatsapp_accounts` and `002_whatsapp_inbound` to the active tenant database under the tenant role.
- The gateway container runs on `syndes-data` and `syndes-whatsapp-egress`, with no published ports, and restarts automatically.
- Internal `/healthz` = 200, unauthenticated account listing = 401, tenant-token authenticated account listing = 200 with zero accounts; external DNS for `web.whatsapp.com` resolved.
- Access to the root-protected deployment source under `/srv/syndes-lab` is currently unavailable to the operator session. Do not reconstruct or replace those running Compose services from partial configuration. Existing CRM and Inbox continue unchanged. Coordinate a privileged deployment of the already-built Core Host and workspace images via the original Compose overlays, then perform QR and Inbox acceptance tests.
