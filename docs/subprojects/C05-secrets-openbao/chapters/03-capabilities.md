## 3. Capabilities

| Componente | Capacidade de código | Estado |
|---|---|---|
| OpenBao server | Raft, HTTPS, ACL/AppRole conforme configuração | Container Up, estado do cofre não verificado |
| Renderer infra | AppRole, KV, escrita atômica de arquivos e revoke-self | Implementação versionada |
| Core Host | `loadCoreSecrets` e `openBaoSourceFromEnv` | Testes de unidade mockados |
| Manager | Renderer/provisioner próprios | Operação não verificada |
| Policies `*.hcl` | Escopos declarados | Ativação não verificada |
| Rotação, backups e recuperação | Runbook de preparação | Sem ensaio de ambiente-alvo |

A ausência de frontend próprio é deliberada: segredos são providos pelo backend/infraestrutura.
