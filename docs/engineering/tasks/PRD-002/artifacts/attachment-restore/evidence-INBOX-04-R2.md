# Evidência INBOX-04-R2 — Drill de backup/restore de anexos tenant-scoped

## Execução

- **Data:** 2026-10-29T12:07:38.445Z
- **Script:** `docs/engineering/tasks/PRD-002/artifacts/attachment-restore/drill.mjs`
- **Ambiente:** Node.js v24.19.0 (apenas built-ins; sem node_modules, sem banco, sem provider externo)
- **Resultado geral:** `PASS`
- **Total de verificações:** 24 | Passou: 24 | Falhou: 0

## Tenants sintéticos (descartáveis)

| Tenant | UUID |
|---|---|
| Tenant A | `98b91a8d-16b8-43c7-9a6d-f6f3d422e06d` |
| Tenant B | `3d4d3dc3-25f0-439e-bbdd-6f7cee971ef5` |

## Amostra de anexos

| Arquivo | Tenant | MIME | Tamanho | SHA-256 |
|---|---|---|---|---|
| `documento.png` | A | `image/png` | 12 bytes | `0f6c3a09018d44c79811cb205e1e03f0f214fdd8728f82e6e92aaaf95da5ee49` |
| `nota.txt` | A | `text/plain` | 48 bytes | `1a750c1ef80ee96e49e1e4e6e84cd8d61ca938f58396de38a1e5ee7660060e34` |
| `relatorio.pdf` | B | `application/pdf` | 40 bytes | `59e94c875ade4cf5257751176a7f372e61d7d0ac6a53389e7ffb681820232cb3` |

## Resultado por verificação

| # | Verificação | Status | Detalhe |
|---|---|---|---|
| 1a | Upload PNG válido (tenant A) | PASS | sha256=… size=12 |
| 1b | Upload TXT válido (tenant A) | PASS | sha256=… size=48 |
| 1c | Upload PDF válido (tenant B) | PASS | sha256=… size=40 |
| 1d | MIME não permitido rejeitado | PASS | mime_not_allowed |
| 1e | Extensão divergente rejeitada | PASS | extension_mismatch |
| 1f | Tamanho excedente rejeitado | PASS | attachment_too_large |
| 1g | Nome com traversal rejeitado | PASS | invalid_filename |
| 1h | Assinatura binária divergente rejeitada | PASS | signature_mismatch |
| 2 | Checksum SHA-256 pré-backup | PASS | 3 amostras verificadas |
| 3 | Backup do storage tenant-scoped | PASS | 2 tenants no backup |
| 4 | Restore em ambiente isolado | PASS | 2 tenants no restore |
| 5 | Checksum SHA-256 pós-restore | PASS | 3 amostras batem com pré-backup e metadado |
| 6 | Download autorizado (mesmo tenant) | PASS | documento.png size=12 |
| 7 | Cross-tenant denial | PASS | tenant A bloqueado ao ler arquivo do tenant B |
| 8 | Path traversal bloqueado | PASS | 3 chaves de traversal rejeitadas |
| 9 | Chave de tenant estrangeiro bloqueada | PASS | objeto do tenant B rejeitado no contexto A |
| 10 | Detecção de corrupção (checksum divergente) | PASS | digest mismatch detectado |
| 11 | Teardown | PASS | todos os diretórios temporários removidos |

## Restrições respeitadas

- Tenant e arquivo descartáveis; nunca banco compartilhado ou dados reais.
- Não publica URL permanente, não usa provider externo, não apaga dados reais.
- Não toca source code salvo o harness mínimo claramente necessário.
- Não commit, push, merge ou autoaceite.

## Resultado

**PASS** — reproduzível executando `node docs/engineering/tasks/PRD-002/artifacts/attachment-restore/drill.mjs`.
