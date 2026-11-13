# I10 — 06 | Testes e evidências

| Gate | Evidência | Estado |
|---|---|---|
| Leitura estática do script | `scripts/events/disposable_restore_drill.py`, `main` em 13/11/2026 | Fonte observada |
| Execução Docker/PostgreSQL 17 | Sem log de execução nesta revisão | Não verificada |
| Comparação de ledgers e idempotência | Verificações declaradas no código | Não executadas aqui |
| RPO/RTO, restore real e homologação | Sem evidência operacional | Não comprovados |
| MkDocs, links, registry | Exigem gate sobre branch completa | Pendente |

Executar apenas testes autorizados em ambiente isolado, sem dados reais; registrar SHA, comando e resultado sanitizado antes de qualquer promoção de estado.
