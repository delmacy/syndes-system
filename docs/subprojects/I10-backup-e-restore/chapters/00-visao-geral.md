# I10 — 00 | Visão geral

Auditoria estática parcial do ensaio sintético `scripts/events/disposable_restore_drill.py`, observado no `main` em 13/11/2026. A unidade trata de continuidade e recuperação; **o ensaio não constitui backup operacional**.

**Evidência:** o cabeçalho do script declara PostgreSQL 17 descartável, Docker sem rede e sem portas publicadas, dados sintéticos e arquivos temporários não criptografados. A fonte não comprova RPO, RTO, retenção, recuperação de produção ou homologação.

[STATUS](../STATUS.md) · [Referência técnica](../REFERENCIA-TECNICA.md) · [Operação](../OPERACAO.md).
