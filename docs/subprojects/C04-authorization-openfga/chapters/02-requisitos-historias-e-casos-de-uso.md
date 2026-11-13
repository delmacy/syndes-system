## 2. Requisitos, histórias e casos de uso

| ID | Fluxo previsto/observado no código | Estado |
|---|---|---|
| C04-RF01 | Backend checa resource-scoped `can_read/can_write` após autenticação e membership | Código em A04, integração real a validar |
| C04-RF02 | Account API chama `can_write` para delegação de roles | Código A06, grants reais não validados |
| C04-RF03 | Event worker exige `service:...`, `event_delivery:...` e `can_process` | Adapter candidato, worker operacional não homologado |
| C04-RF04 | Negativas ou erro de infraestrutura não liberam permissão por fallback | Testes locais/descartáveis, runtime não homologado |

**Casos de aceite pendentes:** usuário sem grant, tenant cruzado, org/workspace divergentes, service falsificado, permissão revogada e indisponibilidade. Esses itens são critérios de auditoria, não features aprovadas adicionais.
