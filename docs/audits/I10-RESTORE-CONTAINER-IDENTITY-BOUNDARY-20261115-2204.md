# I10 — Backup/Restore: identidade do container e fronteira de evidência (2026-11-15)

Base auditada: `main` @ `1cf48cc0a1281017ac58f7b9b9747f663109e151`. Owner do catálogo: I10 (`scripts/events/disposable_restore_drill.py`), maturity `partial`. Este checkpoint não altera produto nem aprova operação.

## Contratos confrontados

- Interface pública/CLI: `--disposable` e `--ack-synthetic` obrigatórios; descrição declara PostgreSQL 17 sintético, rede isolada, nenhuma base operacional, resultados `passed_synthetic_only`.
- Implementação privada: `Postgres.command()` aceita qualquer string de container com prefixo `syndes-events-restore-drill-`; não verifica identidade Docker, labels, ID imutável nem ownership antes de `docker exec`. `safe_database()` valida nomes de bancos, não identidade do container.
- Ciclo de vida: `restore_drill()` usa `docker stop --time 8` com `check=False` no `finally`; não confirma parada ou remoção, logo limpeza bem-sucedida não está comprovada por essa chamada.
- Schemas/migrations: listas `CONTROL` e `TENANT` fixas cobrem bootstrap Control, Organizations, CRM, Inbox, WhatsApp e eventos Core Host; não constituem descoberta exaustiva de migrations futuras.
- Eventos: assertions sintéticas sobre outbox, delivery e consumer inbox; replay idempotente é SQL direto, não execução de consumidor real.
- Testes: `scripts/events/test_disposable_restore_drill.py` tem sete métodos `unittest` com mocks/fixtures locais. O teste de comando rejeita nome operacional conhecido, mas não prova vínculo a um container recém-criado nem falha diante de outro container com o mesmo prefixo. Testes **não executados** nesta auditoria.

## Divergências e limites

- **I10-IDENTITY-01:** guarda por prefixo de nome não autentica o alvo de `docker exec`; a afirmação de isolamento depende da criação correta do container e da ausência de colisão/controle adversarial de nomes. Risco de fronteira, sem evidência de exploração.
- **I10-CLEANUP-02:** `docker stop` sem verificação de retorno deixa resultado da limpeza indeterminado; não declarar remoção garantida.
- **I10-COVERAGE-03:** conjunto fixo de migrations e replay SQL sintético não demonstram recuperação completa do runtime nem homologação de backup de produção.

APIs HTTP próprias: nenhuma identificada nos arquivos inspecionados. Eventos são fixtures dos owners Control/Core/CRM/WhatsApp, não API publicada por I10. Evidência de código e assertions **não** equivale a execução aprovada, deployment ou homologação. Não foi feita inspeção do DevServer, testes, SQL, Docker, build, migrations, CI, workflow, deploy ou merge. Nenhuma alteração fora deste Markdown. Gates globais, reconciliação das 57 unidades + owners extras e SHA efetivamente publicado em GitHub Pages permanecem pendentes.
