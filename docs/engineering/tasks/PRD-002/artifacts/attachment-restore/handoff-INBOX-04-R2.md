# Handoff INBOX-04-R2 — Drill de backup/restore de anexos tenant-scoped

## Identificação

- Task: `INBOX-04-R2`
- Módulo: Inbox (PRD-002) — Sprint 2
- Classificação: `BLOCKER` operacional do Product Gate
- Owner executor: OpenCode2 (NVIDIA-only) — harness/documentação
- Operação: fornece ambiente se necessário

## Objetivo

Executar ou automatizar um drill seguro de backup, restore e autorização de
download de um anexo tenant-scoped, verificando checksum, MIME/tamanho,
path traversal e cross-tenant denial.

## Artefatos de operação

Diretório exclusivo: `docs/engineering/tasks/PRD-002/artifacts/attachment-restore/`

- `drill.mjs` — script executável (Node.js built-ins apenas)
- `README.md` — documentação do drill
- `handoff-INBOX-04-R2.md` — este documento
- `evidence-INBOX-04-R2.md` — evidência de execução (preenchida após o run)

## Restrições aplicadas

- Tenant e arquivo descartáveis; nunca banco compartilhado ou dados reais.
- Verifica path traversal, MIME/tamanho, cross-tenant denial e checksum
  antes/depois.
- Não publica URL permanente, não usa provider externo, não apaga dados reais.
- Não toca source salvo harness mínimo claramente necessário.
- Não commit, push, merge ou autoaceite.

## Critérios de aceitação

- Evidência contém: data, tenant sintético, amostra, checksum, restore,
  autorização e teardown.
- Resultado `PASS` reproduzível ou `BLOCKED` com owner e pré-requisito
  explícito.

## Resultado deste run

Consulte `evidence-INBOX-04-R2.md`.

## Pré-requisito (se BLOCKED)

Nenhum neste run: o drill executa com recursos locais (tmpdir, Node.js
built-ins) e não requer banco de dados, provider externo ou credenciais.
