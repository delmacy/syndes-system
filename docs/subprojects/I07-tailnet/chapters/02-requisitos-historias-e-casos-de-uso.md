## 2. Requisitos, histórias e casos de uso

**Casos derivados do comportamento do código (não histórias aprovadas):**

| Caso | Entrada | Resultado previsto no código |
|---|---|---|
| Verificar porta livre | `mode=free`, sem TCP/Web correspondente | PASS |
| Detectar colisão | `mode=free`, porta já ocupada | BLOCKED |
| Verificar rota privada | `mode=active`, uma rota, HTTPS, proxy exato, Funnel desativado | PASS |
| Recusar exposição pública | `AllowFunnel[hostname]=true` | BLOCKED |
| Recusar desvio de destino | `Proxy` diferente do alvo fixo | BLOCKED |
| Recusar estrutura inválida | JSON/Handlers/TCP/Web incorretos | BLOCKED |

Histórias de usuário formais, RF/RNF e critérios de aceite aprovados **não foram localizados nesta auditoria**. Esses casos exigem fixtures executadas e revisão de owner.
