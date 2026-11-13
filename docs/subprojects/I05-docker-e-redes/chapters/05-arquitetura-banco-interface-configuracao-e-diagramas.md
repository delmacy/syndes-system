## 5. Arquitetura, banco, interface, configuração e diagramas

```mermaid
flowchart LR
 PG[PostgreSQL] --- D[syndes-data]
 PG --- MD[syndes-master-data]
 K[Keycloak] --- D
 K --- S[syndes-secrets interna]
 F[OpenFGA] --- S
 B[OpenBao] --- S
 M[Master API] --- MD
 M --- P[master-private interna]
 W[Master Web] --- P
```

Topologia **declarada** e parcial, sem representar IPs, portas efetivas ou tráfego. `postgres_data` pertence à persistência PostgreSQL; `openbao_raft` ao cofre. Não há Tenant DB, Control DB, classes ou frontend próprio do I05. Configurações secretas e env_file não foram lidas.
