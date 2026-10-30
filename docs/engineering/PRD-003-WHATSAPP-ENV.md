# WhatsApp — configuração de ambiente

A porta fica privada por padrão e só deve ser publicada quando a operação autorizar explicitamente.

```dotenv
WHATSAPP_ENABLED=false
WHATSAPP_BIND_HOST=127.0.0.1
WHATSAPP_PORT=18083
WHATSAPP_WEBHOOK_PATH=/api/v1/whatsapp/webhook
WHATSAPP_PROVIDER=whatsmeow
WHATSAPP_WHATSMEOW_URL=http://127.0.0.1:19083
WHATSAPP_WHATSMEOW_TOKEN=
WHATSAPP_WEBHOOK_TOKEN=
WHATSAPP_REQUEST_TIMEOUT_MS=10000
WHATSAPP_STORE_DSN=
WHATSAPP_SIDECAR_BIND=127.0.0.1:19083
# Opcional; somente HTTPS quando houver exposição autorizada.
WHATSAPP_PUBLIC_BASE_URL=
```

Para server02/Tailscale, o bind pode ser alterado para o endereço do tailnet, mantendo ACLs e firewall restritivos. Nenhum token, QR ou segredo de sessão deve ser colocado neste arquivo sem o mecanismo de secrets aprovado.

No deployment atual, o sidecar permanece em `127.0.0.1:19083` com `network_mode: host`; somente Web/API continuam acessíveis pelo Tailscale Serve. O banco de sessão deve ser dedicado e o role deve ter privilégio apenas nesse banco.
