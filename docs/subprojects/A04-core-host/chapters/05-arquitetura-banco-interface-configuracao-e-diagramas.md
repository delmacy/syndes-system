## 5. Arquitetura, banco, interface, configuração e diagramas

```mermaid
flowchart TD
 C03[Keycloak C03] --> A04[Core Host A04]
 C01[Control C01] --> A04
 C04[OpenFGA C04] --> A04
 C05[OpenBao C05] --> A04
 A04 --> K[Core Kernel]
 K --> PL[Plugins declarados]
 PL --> DB[Tenant DB por owner]
 A04 --> C06[Eventos C06]
```

- **Banco:** `TenantPgProvider` resolve registro e credenciais, não define migrations de plugins. Control mantém catálogo, membership e lifecycle.
- **Configuração:** `config/modules.json` lista cinco plugins confiáveis; não é catálogo de tenant.
- **Interface:** sem frontend A04 próprio; hosts de Workspace/Manager/Support são aplicações distintas.
- **Eventos:** o worker requer admission e service grant; nenhuma fila/outbox foi ativada nesta auditoria.
