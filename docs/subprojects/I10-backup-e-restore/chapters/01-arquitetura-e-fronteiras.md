# I10 — 01 | Arquitetura e fronteiras

O script Python é uma ferramenta de ensaio, não serviço ou módulo HTTP. Declara Docker CLI, `postgres:17-alpine`, banco temporário, `pg_dump` e `pg_restore`; o código restringe nomes de banco por `SAFE_DB` e exige confirmação explícita de modo sintético.

As fixtures de Control e tenant pertencem aos respectivos owners. Referenciar seus SQL não transfere ownership a I10 e não autoriza migrations, grants ou operações em ambientes reais. Frontend, API pública e integração operacional não foram comprovados nesta inspeção.

Fonte: `scripts/events/disposable_restore_drill.py` (main consultado em 13/11/2026). [Referência técnica](../REFERENCIA-TECNICA.md).
