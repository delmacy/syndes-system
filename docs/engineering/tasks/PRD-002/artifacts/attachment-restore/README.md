# INBOX-04-R2 — Artefatos do drill de backup/restore de anexos

Este diretório contém o **drill descartável** de backup, restore e autorização de
download de anexos tenant-scoped do módulo Inbox (PRD-002), conforme definido
em `INBOX-04-R2-attachment-restore-drill.md`.

## Propriedade (ownership)

Exclusivo: `docs/engineering/tasks/PRD-002/artifacts/attachment-restore/`
e o handoff `INBOX-04-R2`.

## Conteúdo

| Arquivo | Finalidade |
|---|---|
| `drill.mjs` | Script executável do drill (Node.js, apenas built-ins). |
| `README.md` | Este documento: como executar, o que verifica, restrições. |
| `handoff-INBOX-04-R2.md` | Handoff da task para coordenação/revisão. |
| `evidence-INBOX-04-R2.md` | Evidência de execução (preenchida após o run). |

## Como executar

```sh
node docs/engineering/tasks/PRD-002/artifacts/attachment-restore/drill.mjs
```

Não requer `node_modules`, banco de dados, provider externo ou credenciais.
Cria diretórios temporários no `tmpdir` do sistema, executa todas as
verificações e remove tudo ao final (teardown).

## O que o drill verifica

1. **Validação de upload** — MIME allowlist, extensão condizente com o MIME,
   assinatura binária (magic bytes para PNG/JPEG/WebP/PDF; UTF-8 para text/*),
   tamanho dentro do limite (10 MiB default, teto 25 MiB), nome de arquivo
   sem traversal/caracteres de controle.
2. **Checksum SHA-256** — calculado antes do backup e verificado depois do
   restore; deve bater com o metadado persistido.
3. **Backup do storage** — cópia do volume de anexos por diretório de tenant.
4. **Restore em ambiente isolado** — recriação do storage a partir do backup,
   nunca apontando para tenant ao vivo.
5. **Download autorizado** — leitura de anexo dentro do mesmo tenant com
   checksum e tamanho conferidos.
6. **Cross-tenant denial** — leitura de anexo de tenant B com contexto de
   tenant A é recusada (chave de objeto nomeia tenant diferente).
7. **Path traversal** — chaves de objeto com `../`, `./..`, etc. são recusadas
   antes de qualquer acesso ao sistema de arquivos.
8. **Detecção de corrupção** — alteração de um byte no objeto faz o download
   falhar com erro de digest divergente.
9. **Teardown** — todos os diretórios temporários são removidos.

## Restrições respeitadas

- Tenant e arquivo descartáveis; nunca banco compartilhado ou dados reais.
- Não publica URL permanente, não usa provider externo, não apaga dados reais.
- Não toca source code salvo o harness mínimo claramente necessário (este
  drill é um script autônomo, sem importar módulos da aplicação).
- Registro de impedimento ambiental exato se o storage necessário não estiver
  disponível (resultado `BLOCKED` com pré-requisito explícito).

## Critérios de aceitação

- Evidência contém: data, tenant sintético, amostra, checksum, restore,
  autorização e teardown.
- Resultado `PASS` reproduzível ou `BLOCKED` com owner e pré-requisito
  explícito.
