# I07 — Tailnet | Referência técnica

> Inventário **parcial de fonte**, não homologação. [Checkpoint GitHub-first](../../evidence/checkpoints/I07-tailnet-source-audit-20261113.md).

## Stack e ownership
- Python 3, biblioteca padrão (`argparse`, `json`, `sys`).
- Fonte: [`infra/master-admin/check-tailnet-route.py`](../../../infra/master-admin/check-tailnet-route.py), blob `d51f6e69f2b0a04670eaf7c7119950fa53da1452`.
- I07 é componente documental de Tailnet subordinado a I02. O script valida configuração estruturada Tailscale Serve para o Manager; não gerencia Traefik nem substitui controles de autenticação.

## Contratos internos e CLI
| Símbolo | Entrada | Saída e efeitos |
|---|---|---|
| `check(config, mode, port=9447, target="http://127.0.0.1:18085")` | Dicionário JSON Serve, `free`/`active` | Tupla `(bool, message)`; sem mutação |
| `main()` | `--mode`, `--port`, `--target`, stdin JSON | Exit 0/2; mensagens `PASS`/`BLOCKED` |

`free` reprova porta TCP/Web ocupada. `active` exige uma única rota Web correspondente, `TCP[port].HTTPS == True`, `Handlers` somente com `/`, `Proxy` exatamente `http://127.0.0.1:18085` e Funnel não habilitado para o hostname. Erros estruturais falham fechados; hostnames não são impressos.

## APIs, eventos, dados, frontend e dependências
- Não há API HTTP de negócio, consumer de evento, migration SQL ou tela frontend próprios demonstrados por **esta fonte**.
- O destino HTTP local é um serviço de outro owner; não atribuir sua implementação a I07.
- Dependência de formato JSON de Tailscale Serve; configuração/ACL efetiva não verificada.
- O middleware Traefik `syndes-tailnet-only@docker` citado em I06 é referência distinta; não comprova restrição ativa.

## Testes e limites
Nenhum teste foi executado neste checkpoint. Verificar fixtures de porta livre, rota ativa válida, conflito, HTTPS ausente, target errado, Funnel e JSON inválido antes de promover maturidade. [STATUS](STATUS.md) · [OPERACAO](OPERACAO.md).
