## 3. Capabilities

| Capacidade | Fonte | Classificação |
|---|---|---|
| Roteamento declarativo Core Host/Workspace | `modules/whatsapp/deploy/devserver01-cutover.compose.yaml` | Presente em manifesto; runtime não aceito |
| Seleção por host, prefixo e prioridade | Mesmo Compose | Presente em manifesto |
| Middleware `syndes-tailnet-only@docker` | Referência em labels | Existência e efeito não verificados |
| HTTPS/TLS/redirect e certificados | Requer configuração Traefik ativa | Pendente de evidência |
| Reversão do cutover | `modules/whatsapp/deploy/README.md` | Procedimento descrito; não executado neste gate |
