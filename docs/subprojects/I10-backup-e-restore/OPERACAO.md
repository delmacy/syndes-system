# I10 — Backup e Restore | Operação

> **Não é runbook de produção.** Auditoria estática parcial no SHA `8d17879b24fe3162f6b3e8a5776e25dd6d9cbc7b`.

## Ensaio sintético declarado
A fonte `scripts/events/disposable_restore_drill.py` requer flags `--disposable` e `--ack-synthetic`. Declara PostgreSQL 17 em Docker com rede `none`, contêiner aleatório, arquivos temporários com permissões restritas, `pg_dump`/ `pg_restore`, checksums SHA-256, comparação de ledgers, ACL e replay idempotente.

**Não executar este ensaio contra infraestrutura operacional.** Não aceitar como evidência de recuperação real, RPO, RTO, retenção, criptografia ou restore de produção.

## Gates documentais e operacionais
1. Revisar código, fixtures e ownership no SHA exato.
2. Obter autorização para ambiente isolado, validar dependências e executar somente ensaio descartável; registrar logs sanitizados e resultado.
3. Executar checagens de Markdown, links, navegação e registry sobre a branch documental.
4. Exigir aprovação dos owners e evidência separada para qualquer processo operacional real.

**Nesta passagem:** inspeção estática somente; nenhum teste, Docker, SQL, runtime ou deploy executado. [STATUS](STATUS.md) · [Referência técnica](REFERENCIA-TECNICA.md) · [Evolução](EVOLUCAO.md).
