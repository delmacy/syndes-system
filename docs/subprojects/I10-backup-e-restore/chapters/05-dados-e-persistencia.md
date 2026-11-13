# I10 — 05 | Dados e persistência

O ensaio referencia schemas em `infra/postgres/bootstrap/` e arquivos SQL de `modules/organizations/`, `modules/core-crm/`, `modules/inbox/`, `modules/whatsapp/` e `apps/core-host/`. O inventário de caminhos está na constante `CONTROL` e `TENANT` do script.

A ferramenta declara arquivo de dump temporário, SHA-256, verificação de permissões e restauração em PostgreSQL 17 descartável. **Não há prova de backup real, criptografia de arquivo, retenção ou restore em ambiente operacional.** Nenhum SQL foi executado nesta reconciliação documental.
