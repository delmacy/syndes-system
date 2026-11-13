## 5. Arquitetura, banco, interface, configuração e diagramas

```mermaid
flowchart TD
 CA[Autoridade de confiança] --> B[OpenBao HTTPS C05]
 B --> KV[KV e AppRole]
 KV --> R[Renderer em container isolado]
 R --> TMP[Tmpfs protegido]
 TMP --> DB[Consumidores infra]
 KV --> A[A04 loadCoreSecrets]
 A --> HOST[Core Host]
```

**Persistência:** volume Raft próprio `openbao_raft`; não é database PostgreSQL Tenant/Control. **Rede:** `syndes-secrets` de escopo de serviços autorizados, sem pressupor host publicado. **Frontend:** nenhum próprio. **Configuração:** fontes listam `BAO_ADDR`, `CORE_OPENBAO_URL`, `CORE_BAO_ROLE_ID_FILE`, `CORE_BAO_SECRET_ID_FILE` e paths de runtime; não incluir valores/credenciais.

**Migração:** renderer suporta arquivos de outros serviços, mas isso sozinho não atesta migração final de Keycloak/OpenFGA/PostgreSQL.
