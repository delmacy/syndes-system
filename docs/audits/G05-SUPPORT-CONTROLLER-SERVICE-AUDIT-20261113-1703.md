# G05 — Operação e suporte: auditoria estática complementar (2026-11-13 17:03 BRT)

## Proveniência e escopo
- Repositório: `delmacy/syndes-system`; base GitHub `main`: `077eef7b81ceed4ed49c232d11cd408f2c5ef531` (consultada novamente antes de criar esta branch).
- Unidade: G05, governança de operação e suporte; implementação de tickets pertencente ao owner P06 (`modules/support`). **Não transferir ownership do produto para G05.**
- Evidência por GitHub MCP: `modules/support/src/controller.ts` blob `b3a0b4738c74d5514c7caa5f5b30ae3c1f865a97`; `service.ts` `e4962b7ac4d964e76a61344947877c13e27e2212`; `domain.ts` `af8c520580927a14b2130e506828c3823718d9cf`; `nest.module.ts` `3f86d75b78480be6fdc1a9a5eb67b7df0e18a235`; `README.md` `9659d914b150803e512b57332f42bd5b3f85e600`.

## Contratos e classes encontrados
- `SupportHttpModule` registra `SupportController` e `SupportHost`; este injeta `SYNDES_CORE_API` e `SYNDES_TENANT_DB` e constrói `SupportService`. Contrato privado depende de `CoreKernel`, `TrustedTenantDatabaseProvider` e `verifyClient(...,"syndes-support-ui")`.
- Contrato HTTP público relativo: `v1/tenants/:tenantId/support`: GET `:kind/cases`, GET `:kind/cases/:caseId`, GET `:kind/cases/:caseId/events`; POST `internal/cases`, POST `external/cases`, PATCH `:kind/cases/:caseId/status`, PATCH `:kind/cases/:caseId/assignment`, PATCH `:kind/cases/:caseId/queue`, POST `:kind/cases/:caseId/notes`. Total: nove handlers. Prefixo global da aplicação não verificado.
- `SupportService` implementa `createInternal`, `createExternal`, `list`, `get`, `history`, `status`, `assign`, `transferQueue`, `note`; metadado `supportModule` declara dependências `platform`, `crm`, `inbox`, `whatsapp`, `organizations`.
- `domain.ts` define `SupportKind` internal/external, seis estados, quatro prioridades, filas internas e externa, DTOs validados, limites de paginação, grafo de transição de status. Erros mapeados no controller: 400, 401, 403, 404, 409, 503.
- Isolamento declarativo: token de client específico; tenant UUID fixado em configuração de serviço, não por escolha do cliente; actor kind=user; kernel authorization `support:cases:<kind>`; provedor de DB deve retornar `tenantId` igual ao contexto; queries com tenant e membership de fila. Criação externa também exige autorização de leitura de inbox/CRM, WhatsApp habilitado e vínculo com workspace. **Controles observados em fonte, não demonstrados em execução.**
- Eventos: `support_case_events` registra `created`, `status_changed`, `assigned`, `queue_transferred`, `internal_note` dentro de CTE SQL; isso é trilha persistida, **não** prova emissão no barramento de eventos C06. `history` limita a 100 registros e oculta notas internas do solicitante não membro da fila.
- Schema/migrations: queries referenciam `support_cases`, `support_case_events`, `support_queues`, `support_queue_memberships`, além de tabelas de CRM/Inbox/WhatsApp/Workspace. Migration não foi relida nesta rodada; caminho presumido `modules/support/migrations/001_support_cases.sql` retornou 404. Não concluir equivalência schema-query sem localizar arquivo real.
- Divergência documental: `modules/support/README.md` ainda afirma “Este branch é desenvolvimento”, embora os arquivos citados estejam presentes no `main` da base. Não implica homologação.

## Riscos e limites
1. A semântica de erros de não encontrado/ação indisponível usa 404 indistinto, adequada para não revelar objetos, mas requer testes para concorrência e transições.
2. `createExternal` depende de tabelas e colunas de cinco módulos; exige teste real de integração SQL para confirmar compatibilidade e constraints.
3. A autorização `kernel.execute` e a identidade client são interfaces importadas; implementações internas e política OpenFGA não auditadas aqui.
4. CTEs fazem mutação e auditoria em uma instrução SQL; atomicidade pretendida é visível, mas a execução em banco não foi comprovada.
5. Não foram inventariados testes existentes nem consultado CI por SHA nesta rodada; **zero testes executados**.
6. DevServer, ambiente, deploy, migrations aplicadas, credenciais, produção e homologação: **não acessados/não comprovados**.
7. As 57 unidades estão catalogadas, mas esta rodada **não** reconciliou todas nem descobriu exaustivamente owners adicionais. Não declarar divergências zero ou publicação Pages por SHA.

## Próximos gates
Localizar migration e testes reais pelo GitHub; confrontar PRD/ADR e SUP-01..SUP-11 com nove handlers; conferir policies do Core Kernel, eventos C06 e schema por SHA; executar somente testes isolados autorizados; revisão de ownership P06/G05; comparar branch com latest main e só integrar documentação validada após revisão. Este checkpoint isolado não modifica STATUS canônico.
