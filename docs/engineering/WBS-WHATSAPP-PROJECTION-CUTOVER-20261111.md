# WBS — Garantia de um único projetor WhatsApp (2026-11-11)

| ID | Entrega | Estado |
|---|---|---|
| WA-CUT01 | Migration 008: `projection_path` default legacy, constraint e trigger de imutabilidade | Implementado em worktree; PG17 testado |
| WA-CUT02 | Leitor legado compatível com schema antigo/novo e filtro legacy | Implementado; regressões necessárias |
| WA-CUT03 | Bridge publica somente path events; duplicado legacy não cria outbox | Implementado; PG17 comprovado |
| WA-CUT04 | Reader e comando de ack do WhatsApp recusam evento de path legacy | Implementado; PG17 comprovado |
| WA-CUT05 | Testes de exclusividade, idempotência, upgrade, rollback de ingress | Implementado parcialmente; cutover real ainda não exercitado |
| WA-CUT06 | ADR, WBS, AGENTS e migration CLI | Preparado; CI/merge pendentes |
| WA-CUT07 | Backup/restore **real** e migration 008 em staging aprovado | **Bloqueado** por autorização e evidência operacional |
| WA-CUT08 | Garantir 100% das instâncias legadas na versão com filtro, sem processos antigos | **Pendente — gate crítico** |
| WA-CUT09 | Gate Host-only de ingress por account/tenant, identidade service, scheduler e observabilidade | **Pendente** |
| WA-CUT10 | Canary, rollback, reconciliação de órfãos/ambíguos, frontend autenticado | **Pendente; não ativar** |

**Regra de negócio:** a propriedade de cada inbound é imutável; não trocar path de registros existentes para simular rollback. O projetor legado mantém metadados, histórico, snapshots, receipts e outbound nesta fase.

**Não houve** DDL/DML em bancos operacionais; SQL002 permanece ativo; frontend e workflow GitHub Actions não foram modificados.
