## 6. Persistência, migrações e propriedade de schemas

**Banco:** database canônico separado por tenant, resolvido exclusivamente pelo provedor confiável do Core Host.
**Migrations do módulo:** `modules/core-crm/sql/001_crm_foundation.sql`, `002_crm_tags_notes.sql`, `003_crm_employees_channels.sql`.

| Domínio | Conteúdo | Regras |
|---|---|---|
| Person | Nome confirmado, e-mail, telefone, archive | Tenant-scoped, normalização |
| Organization CRM | Razão social, fantasia, tax ID, archive | Distinta de Platform Organization |
| Relação | Person↔Organization | FK/tenant-aware, escrita auditável |
| Tag / PersonTag | Classificação | Somente tenant e permissões autorizados |
| Note / Timeline | Registro e histórico | Autoria/tempo; não alterar silenciosamente histórico |
| EmployeeProfile | Perfil relacionado à pessoa | Não equivale a identidade Keycloak |
| ChannelIdentity | Identificador externo de canal | Preserva origem e nomes confirmados |

**Regras:** queries parametrizadas e tenant-aware; não usar DSN selecionado pelo cliente; o Host não deve executar DDL privilegiado em atendimento HTTP. Migrações são realizadas por operador/instalador autorizado com preflight, backup preventivo e plano de retorno.

**Limites do MVP documentados:** importação CSV até 500 linhas / 1 MiB; exportação até 1.000 registros, neutralizando fórmulas; resultados paginados e limitações conforme controllers/testes. Confirmar limites exatos antes de modificar contratos.

---
