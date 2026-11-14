# I07 — Tailnet | STATUS

> Documentação-base, SEM AUDITORIA FUNCIONAL. Ver ESCOPO.md e SPRINT.md nesta pasta.

## Onde paramos?
- Estrutura documental criada; maturidade operacional não verificada.
- Fonte rastreável: infra/master-admin/check-tailnet-route.py

## Para onde vamos?
- Revisar escopo e contratos do próprio módulo; aprovar primeiro incremento.

## WBS e capabilities
| ID | Estado | Evidência | Próxima etapa |
|---|---|---|---|
| I07.DOC.01 | PENDENTE DE REVISÃO | Catálogo da unidade | Inventariar requisitos |

## Dependências e bloqueios
- A INVENTARIAR com contratos públicos, distinguindo dependências obrigatórias e opcionais.

## Checkpoints
| Data | Resultado | SHA / CI / ambiente | Continuidade |
|---|---|---|---|
| 2026-11-12 | Estrutura documental inicial | Não constitui evidência operacional | Revisar o escopo |

## Auditoria estática I07 — 2026-11-14

- Base inspecionada: `main` `1cf48cc0a1281017ac58f7b9b9747f663109e151`; fonte `infra/master-admin/check-tailnet-route.py`, blob `d51f6e69f2b0a04670eaf7c7119950fa53da1452`.
- **Fonte existente:** `check(config, mode, port=9447, target="http://127.0.0.1:18085")` e `main()`; verifica mapeamentos TCP/Web, HTTPS, handler `/`, Proxy e AllowFunnel. Modo `free` apenas verifica ausência de alocação; modo `active` valida uma rota correspondente.
- **Testes:** execução e aprovação não comprovadas nesta revisão; nenhuma evidência de integração/CI específica foi validada.
- **Implantação/homologação:** não comprovadas. O retorno `PASS` do verificador, isoladamente, não prova conectividade nem posse do serviço.
- **Riscos pendentes:** validar formatos reais de Tailscale Serve JSON e casos adversariais; conferir todos os caminhos de Funnel e configuração fora da porta; confirmar conectividade e autenticação com evidência autorizada.
- Antecedentes documentais: PRs #111, #141 e #142, ainda sujeitos à revisão e consolidação; não tratar seus checkpoints como homologação.
- **Gate:** NÃO INTEGRAR até MkDocs estrito, links, registry, ownership, revisão de concorrência e publicação Pages SHA comprovados.
