# I07 — Tailnet | STATUS

> Auditoria estática parcial de fonte, **sem auditoria funcional, execução comprovada ou homologação**. Ver [ESCOPO](ESCOPO.md), [SPRINT](SPRINT.md) e [referência técnica](REFERENCIA-TECNICA.md).

## Onde paramos?
- Fonte efetivamente lida no `main` `1cf48cc0a1281017ac58f7b9b9747f663109e151`: `infra/master-admin/check-tailnet-route.py`, blob `d51f6e69f2b0a04670eaf7c7119950fa53da1452`.
- O código Python define `check(config, mode, port=9447, target="http://127.0.0.1:18085")` e uma CLI com `--mode free|active`. Recebe JSON via stdin; retorna código 0 em aprovação estática ou 2 em bloqueio.
- No modo `free`, rejeita porta já declarada em TCP ou Web. No modo `active`, exige rota Web única, `TCP[port].HTTPS is True`, somente handler `/`, proxy exato ao loopback aprovado e `AllowFunnel[hostname]` diferente de `True`.
- **Limite de evidência:** análise do código não comprova execução de testes, conectividade Tailnet, identidade/autorização de cliente, disponibilidade HTTPS, deploy ou aceite. O código não deve ser tratado como prova de configuração Serve ativa.
- Existe trabalho concorrente de auditoria I07 em `docs/i07-tailnet-source-check-20261114-1217` (1 commit à frente do main no momento da comparação). Preservar e revisar antes de integrar; não substituir sua evidência.

## Para onde vamos?
1. Revisar contratos, ameaças e ownership da rota com o responsável de I07.
2. Executar testes isolados e gates documentais, registrar comando, ambiente, resultado e SHA, sem operar Tailnet real.
3. Conciliar os capítulos temáticos, referência, operação e plano/WBS com os PRs concorrentes; somente promover estado após evidências independentes.

## WBS e capabilities
| ID | Estado | Evidência | Próxima etapa |
|---|---|---|---|
| I07.DOC.01 | PARCIAL — fonte auditada estaticamente | `check-tailnet-route.py` blob `d51f6e69` | Reconciliar dossiê completo |
| I07.TEST.01 | NÃO COMPROVADO | Nenhum resultado de teste verificado nesta revisão | Testes isolados, registrar SHA e saída |
| I07.OPS.01 | NÃO HOMOLOGADO | Nenhuma prova operacional examinada | Verificação autorizada e aceite |

## Dependências e bloqueios
- Contratos públicos e ownership pendentes de revisão integral; não inferir autorização, segurança de transporte efetiva ou estado de produção.
- Gates MkDocs estrito, links, registry, ownership e GitHub Pages SHA ainda não comprovados.

## Checkpoints
| Data | Resultado | SHA / CI / ambiente | Continuidade |
|---|---|---|---|
| 2026-11-12 | Estrutura documental inicial | Não constitui evidência operacional | Revisar escopo |
| 2026-11-14 | Leitura estática da fonte e comparação de branch concorrente | main `1cf48cc0`; blob `d51f6e69`; CI/ambiente não verificados | Reconciliar dossiê e validar gates |
