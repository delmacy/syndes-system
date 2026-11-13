## 3. Capabilities

| Capability | Declarado | Comprovação |
|---|---|---|
| PostgreSQL em Compose | Imagem 17-bookworm, volume `postgres_data`, redes externas | Arquivo versionado |
| Segurança em Compose | Keycloak 26.8.1, OpenFGA 1.22.1, OpenBao 2.7.0 | Arquivo versionado |
| Segredos em rede interna | `syndes-secrets: internal: true` | Somente configuração |
| Manager segregado | `master-private: internal: true`, web loopback | Somente configuração |
| Runtime observado | 16 containers Up, redes bridge Syndes/Komodo | Inventário parcial read-only |
| Topologia completa, isolamento e recovery | Não demonstrados | Pendente |
