# INBOX-04-R2 — Drill de backup/restore de anexos

- **Classificação:** `BLOCKER` operacional do Product Gate
- **Owner executor:** OpenCode2 NVIDIA-only para harness/documentação; operação fornece ambiente se necessário
- **Ownership:** arquivos de operação em `docs/engineering/tasks/PRD-002/artifacts/attachment-restore/`

## Objetivo

Executar ou automatizar um drill seguro de backup, restore e autorização de download de um anexo tenant-scoped.

## Restrições

- Usar tenant e arquivo descartáveis; nunca banco compartilhado ou dados reais.
- Verificar path traversal, MIME/tamanho, cross-tenant denial e checksum antes/depois.
- Não publicar URL permanente, não usar provider externo e não apagar dados reais.
- Registrar impedimento ambiental exato se o storage necessário não estiver disponível.

## Aceite

- Evidência contém data, tenant sintético, amostra, checksum, restore, autorização e teardown.
- Resultado `PASS` reproduzível ou `BLOCKED` com owner e pré-requisito explícito.
