# I10 — Backup e Restore | STATUS

> **Auditoria estática parcial em 13/11/2026**, fonte `scripts/events/disposable_restore_drill.py` no main `8d17879b24fe3162f6b3e8a5776e25dd6d9cbc7b`. Não é aprovação operacional.

## Estado por dimensão

| Dimensão | Evidência | Estado |
|---|---|---|
| Fonte | Script Python com `main`, `restore_drill`, `Postgres`, `verified_archive` | Encontrada e lida |
| Documentação | Fronteira do ensaio sintético identificada | Auditoria parcial |
| Testes | Nenhum Docker/PG17 executado nesta auditoria | Não verificados |
| Integração | Script declara isolamento de rede e dados sintéticos | Não verificada por execução |
| Produção / homologação | Relatório do script marca `production_backup_verified=False` e `production_restore_approved=False` | Não comprovadas |

## Gates pendentes
- Revisar o script e fixtures/migrations com os respectivos owners.
- Executar apenas em ambiente isolado autorizado, com Docker descartável, e registrar SHA, saída sanitizada e resultado.
- Testar permissões, restauração, idempotência e retenção sem tocar dados reais.
- Revisar o diff documental, links e gates do site antes de integração.

## WBS
| ID | Estado | Evidência | Próximo gate |
|---|---|---|---|
| I10.DOC.01 | Parcial | Fonte Python identificada neste SHA | Revisão de owner |
| I10.TEST.01 | Pendente | Ensaio sintético definido em código, não executado aqui | Teste isolado |
| I10.OPS.01 | Bloqueado | Sem prova de backup/restauração real | Política e aceite operacional |

## Reconciliação de fonte e concorrência — 13/11/2026, 21h (BRT)

- Fonte reconsultada diretamente no `main` GitHub `3a943ea518df2239525d2f518bb1b061671bc358`: `scripts/events/disposable_restore_drill.py`, blob `f381ffe9948cfc63c8bb19fef9a78f3c2d9743f4`. A identidade do blob coincide com a leitura registrada no capítulo 04 no commit `fa10ac79`; **não há evidência de mudança desse script entre essas leituras**.
- O cabeçalho declara ensaio **sintético**, Docker com rede desativada e sem portas publicadas, arquivos temporários e arquivos de dump protegidos por permissões, **não criptografados**. Requer `--disposable` e `--ack-synthetic`. Trata-se de declaração de fonte, não teste executado.
- A branch documental de origem `docs/i10-static-contract-reconcile-20261113-2016` estava **15 commits à frente e 9 atrás** do `main` no momento da comparação. Sua integração requer nova comparação e revisão dos arquivos concorrentes; não foi realizada.
- A auditoria **não** demonstra backup operacional, restauração real, RPO/RTO, política de retenção, testes Docker/PG17, CI documental, revisão do owner ou homologação. Nenhum witness AST novo é justificado por esta leitura.
