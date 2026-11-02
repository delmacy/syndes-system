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
- Database `syndes_whatsapp_gateway` and LOGIN role `syndes_whatsapp_gateway` created. The role's password **was not set**: the secure execution tool blocked that step. Do not start the gateway with the postgres superuser.
- Outbound network `syndes-whatsapp-egress` exists; `syndes-data` remains internal.
- Secret material was generated locally in `/home/delmacy/.config/syndes-whatsapp/` with restricted permissions. **Never commit, print, or copy these secret values into issue/PR logs**.
- On the authorized host, a human operator can use interactive PostgreSQL `\\password syndes_whatsapp_gateway` in `psql`; this avoids entering a password in shell history. Ensure the configured password and the gateway DSN match.
- The Core Host currently running on DevServer01 is the previous image. Updating it must preserve `/srv/syndes-lab/system` and its existing Compose overlays/secret mounts.
- Acceptance is not completed: wait for DB credential provisioning, deploy both images with consistent secrets, apply tenant migrations, then pair a test number and verify bidirectional WhatsApp/Inbox messaging.
