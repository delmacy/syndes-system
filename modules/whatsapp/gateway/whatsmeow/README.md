# Syndes Whatsmeow sidecar

Internal Go adapter for Whatsmeow. It binds to `127.0.0.1:19083` by default,
persists Whatsmeow sessions in a dedicated PostgreSQL database and exposes only
authenticated session/message operations to the Nest API. Inbound events are
posted back to the API with a separate bearer token; payloads never carry a
database name.

Required environment variables:

- `WHATSAPP_STORE_DSN`
- `SYNDES_API_URL`
- `WHATSAPP_WHATSMEOW_TOKEN`
- `WHATSAPP_WEBHOOK_TOKEN`

Optional: `WHATSAPP_SIDECAR_BIND` (default `127.0.0.1:19083`). Never expose the
sidecar directly to the public internet.
