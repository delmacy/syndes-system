# Syndes Service Management (PRD-003A)

Primeiro incremento de domínio do **funil essencial de atendimento**: funis configurados com etapas simples, protocolo persistido, vínculo opcional à Inbox, abertura idempotente por requisição, atribuição de operador autorizado, progressão manual, conclusão e auditoria append-only.

**Não integra o Core Host operacional:** nenhum controller, migration de tenant, menu, provider ou grants foi publicado. O módulo requer Kernel autorizado e provider transacional confiável fornecidos pelo Host **após** os gates de release. A migração `sql/001_service_funnels.sql` é exclusivamente de instalação operator-gated e depende de Organizations/CRM/Inbox. Não a execute em ambiente operacional sem restore e autorização.

Referências: `docs/product/PRD-003A-GESTAO-ATENDIMENTOS-MVP.md` e `docs/engineering/WBS-GESTAO-ATENDIMENTOS-MVP-20261111.md`.
