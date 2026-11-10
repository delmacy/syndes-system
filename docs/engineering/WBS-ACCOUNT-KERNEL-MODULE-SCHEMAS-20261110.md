# WBS — Account & Access unificado, Core Kernel e schemas modulares

**Baseline:** 2026-11-10 • **Status:** PLANEJADO / não executado no banco • **Repositório:** `delmacy/syndes-system` • **ADR:** [ADR-ACCOUNT-KERNEL-MODULE-SCHEMAS-20261110.md](ADR-ACCOUNT-KERNEL-MODULE-SCHEMAS-20261110.md).
Esta WBS **é um desdobramento técnico** das frentes 00/10/30/50/70/95 da [WBS mestre](WBS-PROGRAMA-SYNDES-20261110.md), não um planejamento concorrente. Classificação: **P0** infraestrutura/segurança necessária; **P1** migração MVP; **P2** melhorias condicionadas. Estados: `PEND`, `BLOCKED`, `DONE` com evidência explícita.

## Regras de execução

- **Um módulo por vez:** a fundação comum é transversal; depois migrar **Organizations → CRM → Inbox → WhatsApp → Support** apenas respeitando dependências de SQL/Host e sem declarar os módulos funcionalmente DONE. Scheduling/AI/Documents/Email/Onboarding/Billing/Commercial permanecem na sequência do MVP e recebem schema desde o início, sem antecipar features.
- Fase sem clientes permite remodelar **fixtures e bancos descartáveis**, não permite descartar silenciosamente DevServer01, tenant interno Syndes, dados de homologação, grants, ou histórico. Operações persistentes precisam de inventário/backup/aceite.
- Em qualquer ponto: Keycloak, OpenFGA e OpenBao preservados como autoridades; Manager separado; owner de conta não herda operações de CRM/Support; SQL 002 e Product Gate #31 permanecem até liberação específica.
- Nenhuma interface visual nova é necessária para iniciar; unificação significa API e modelo administrativo coerentes. UI só após contratos, testes e Product Gate.
- Entrega de cada item: commit, testes unitários/PG17 negativo, documentação, revisão de superfície afetada e evidência do SHA em CI. `IMPLEMENTED != INTEGRATED != TESTED != PROVEN != DONE`.

## Fases, tarefas e gates

### F0 — baseline, dependências e segurança (P0, G0)

| ID | Trabalho | Critério de aceite observável | Dependência | Estado |
| --- | --- | --- | --- | --- |
| AK-00.01 | Inventário por módulo: tabelas, views, FK, funções, triggers, queries, scripts e usuários SQL | Matriz `public` → schema nomeado por objeto, consumidores e ordem de migração; incluir Organizations 001–008, CRM 001–003, Inbox, WhatsApp, Support | — | PEND |
| AK-00.02 | Inventariar bancos runtime/staging/demo e dados relevantes; separar descartáveis | Relatório sem segredos e plano de snapshots/rollback, sem presumir banco vazio | AK-00.01 | PEND |
| AK-00.03 | Congelar contratos de integração e critérios de segurança | ADR revisado; nenhum cross-tenant, grants implícitos, acesso Master↔tenant ou módulos não habilitados | AK-00.01 | PEND |
| AK-00.04 | Coordenar com WBS mestre, PRs #63/#64 e CI delegada | Matriz de impactos sem branches obsoletas e sem nova cadeia de workflows | AK-00.03 | PEND |

**Gate G0:** aprovar mapeamento sem DDL em ambiente operacional. Sem dados de inventário, não executar migração destrutiva.

### F1 — Kernel/Host: contratos e catálogo (P0, G1)

| ID | Trabalho | Critério de aceite observável | Dependência | Estado |
| --- | --- | --- | --- | --- |
| AK-10.01 | Evoluir `ModuleDefinition`/`SyndesPlugin` para schema, migrações versionadas e read-model dependencies | Manifests validados; IDs reservados; falhar em dup, ciclo, path/SQL arbitrário; compatibilidade de consumidores testada | AK-00.03 | PEND |
| AK-10.02 | Catálogo de módulos/versões com dependências e flags de disponibilidade no Control DB | SQL e API/ports com validações por tenant; migrations aplicadas duas vezes em PG17 descartável; sem concessão de FGA implícita | AK-10.01 | PEND |
| AK-10.03 | Entitlements e estados de instalação/ativação/suspensão por tenant | `available/entitled/installed/enabled/suspended/retired` inequívocos; transição auditada, idempotente e testada para dois tenants | AK-10.02 | PEND |
| AK-10.04 | Port `ModuleAccessPort` e validação no Core Host antes de executar módulo | JWT+membership+org/workspace+module entitlement+OpenFGA com falha fechada; HTTP 403, workers não processam módulo suspenso | AK-10.03 | PEND |
| AK-10.05 | Definir manifesto de dependências Core/Org/CRM/Inbox/WhatsApp/Support | Resolver topologia, bloqueio de habilitação e retirada de dependente; testes com combinações A/B | AK-10.01 | PEND |

**Gate G1:** demonstração automatizada: A com CRM+Inbox+WhatsApp, B com CRM apenas; módulo não adquirido retorna deny mesmo com FGA stale e SQL legado presente.

### F2 — Account & Access único (P0, G2)

| ID | Trabalho | Critério de aceite observável | Dependência | Estado |
| --- | --- | --- | --- | --- |
| AK-20.01 | Mapear entidades atuais do Control DB, `account-access-api`, Organizations e Workforce | Uma matriz canônica de account, principal `issuer+sub`, memberships, employee != login, papel, FGA relation, validade e owner | AK-00.03 | PEND |
| AK-20.02 | Completar APIs administrativas autenticadas de consulta e comando | Ler usuários/vínculos/roles/entitlements/validade; grant/revoke idempotente; SQL sem DML direto; owner protegido, auditoria | AK-20.01 | PEND |
| AK-20.03 | Provisionar/reconciliar a intenção de grants no OpenFGA sem dual-write inseguro | Reconcile retry/backoff, idempotência, estados pending/applied/failed, outbox/audit; falha FGA não expõe recurso | AK-20.02 | PEND |
| AK-20.04 | Políticas de vigência e revogação (acesso, organização, workspace, módulo) | Expiração, suspensão, convite e usuário revogado negam API/job; testes de cache/stale grants e tenant B | AK-20.03,AK-10.04 | PEND |
| AK-20.05 | Separação operacional das identidades de serviço e OpenBao | Revisão de AppRoles, paths, rotação, deny-by-default, sem segredo em log/DB; não tocar runtime sem gate G5 | AK-20.01 | PEND |
| AK-20.06 | Contrato para futura administração única no Workspace e Manager | Endpoints/estados/auditoria descritos; Manager continua sem leitura do tenant; **UI não implementada nesta fase** | AK-20.04 | PEND |

**Gate G2:** proprietário e admin possuem capacidades corretas, mas nunca ganham CRM/Inbox automaticamente; grants revogados negam em cenários reais e cross-tenant.

### F3 — instalador e banco por schema (P0, G3)

| ID | Trabalho | Critério de aceite observável | Dependência | Estado |
| --- | --- | --- | --- | --- |
| AK-30.01 | Especificar namespace por módulo e schema protegido `_syndes` para ledger | Nomes seguros, owner SQL vs runtime, migrações transacionais, checksums, versão e audit dos DDL | AK-10.01 | PEND |
| AK-30.02 | Installer `plan/apply/verify` por tenant, módulo e dependências | Control DB aprova mapping, check de entitlement, imagem por digest, dry-run sem efeito, bloqueio de checksum drift e reaplicação idempotente | AK-10.03,AK-30.01 | PEND |
| AK-30.03 | Estratégia de grants PostgreSQL por schema e roles | `CREATE/USAGE/SELECT/INSERT/UPDATE/EXECUTE` mínimo, test role indevida; registrar fase inicial de pool compartilhado sem prometer sandbox | AK-30.01 | PEND |
| AK-30.04 | Operações `disable/reenable/retire`, retenção e rollback | API/worker negam após disable; preserve dados; sem `DROP SCHEMA ... CASCADE`; backup/restore, dependentes e operações em fila | AK-10.04,AK-30.02 | PEND |
| AK-30.05 | Matriz de banco do tenant A/B com módulos diferentes | Criar A com CRM+Inbox+WhatsApp; B com CRM; introspecção pg_namespace e pg_tables/ACL confirma ausência de schemas opcionais; upgrade independente | AK-30.02,AK-30.03 | PEND |

**Gate G3:** DBs descartáveis provisionados somente com schemas de módulos habilitados e dependências requeridas, migrations repetíveis, privacidade e interrupção segura.

### F4 — conversão módulo a módulo (P1, G4)

| ID | Módulo | Ação e dependências concretas | Critério de aceite | Estado |
| --- | --- | --- | --- | --- |
| AK-40.01 | Organizations (infra de contexto) | Migrar `platform_*` de tenant DB para `organizations` sem mover tabelas de Control DB; ajustar índices, guards, triggers, backfill e testes SQL 002 | Contexto default permanece fail-closed; gate multi-org não alterado | PEND |
| AK-40.02 | CRM | `public.crm_*` → `crm.*`; SQL qualificado, FK/queries/exports, plugin e testes | 25 unit regressions, PG17 isolamento, two-tenant, org scopes, UI smoke e migration restore | BLOCKED: AK-40.01 |
| AK-40.03 | Inbox | `public.inbox_*` → `inbox.*`; dependência CRM, FKs cross-schema, stream, inbox/CRM join, UI | Inbox + CRM E2E, revoked grants, versioned contracts, sem cross-org leakage | BLOCKED: AK-40.02 |
| AK-40.04 | WhatsApp | `public.whatsapp_*` → `whatsapp.*`; TS, Go gateway mappings, callback, worker, org routing, rate, receipts | TS+Go+PG17, 40/min/account, deny tenant/org, queue/recovery e acceptance; SQL 002 mantido | BLOCKED: AK-40.03 |
| AK-40.05 | Support | `public.support_*` → `support.*`; tenant operacional Syndes apenas e vínculos Inbox/CRM | Não instala em tenant comercial sem entitlement; E2E/SQL/ticket/restore | BLOCKED: AK-40.04 |
| AK-40.06 | Próximos módulos MVP | `scheduling` etc. começam com schema próprio; PRDs e Product Gates inalterados | Cada módulo pode instalar sem os opcionais não declarados; sem ampliar produto | BLOCKED: sequência MVP |

**Gate G4 por módulo:** a suíte completa do módulo migrado passa no SHA integrado em ambiente descartável. Não fazer conversão de vários módulos em lote sem fechar o gate anterior. Dados operacionais exigem plano aprovado antes da aplicação.

### F5 — segunda camada e integração (P1/P2, G5)

| ID | Trabalho | Critério de aceite observável | Dependência | Estado |
| --- | --- | --- | --- | --- |
| AK-50.01 | Catalogar read models e views de uso real | View tem dono, consumidor, schemas dependentes e contrato versionado; não criar view para cada tela | AK-40.02 | PEND |
| AK-50.02 | Implementar `read`/projeções quando houver caso concreto | View `security_invoker` quando aplicável, grants apropriados, filtros org/tenant, testes de ausência de dependente | AK-50.01,AK-30.03 | PEND |
| AK-50.03 | Eventos/contratos para composição entre módulos | Nenhuma escrita arbitrária cross-schema; consumidores resilientes a desligamento e versão | AK-40.03,AK-50.01 | PEND |
| AK-50.04 | Testar suspensão/desinstalação contra FKs/views/workers | Detecção explícita de dependentes, deny antes de remove, sem perda de dados | AK-30.04,AK-50.02 | PEND |

**Gate G5:** disable de módulo não quebra Core Host nem outros módulos, não preserva acesso indevido e não elimina histórico.

### F6 — integração, homologação e release (P0/P1, G6)

| ID | Trabalho | Critério de aceite observável | Dependência | Estado |
| --- | --- | --- | --- | --- |
| AK-60.01 | Suite transversal: Keycloak real, OpenFGA, OpenBao e PostgreSQL descartável | Owner/admin/agent, wrong audience/azp, fail closed, scope e módulo disabled, tenant A/B, credenciais e logs | G1–G5 | PEND |
| AK-60.02 | CI integrada conforme frente delegada, sem novo acionador | `Syndes CI Gate` impact matrix cobre manifest/SQL/schema/Host/Account/API/Go e regressões | AK-60.01 | PEND (outra frente) |
| AK-60.03 | Inventário, backup e rollout dev/homolog para novo esquema | SHA/digest fixo, snapshots, migrate/check, smoke/rollback em DevServer01, sem tocar Prod automaticamente | AK-00.02,AK-60.02 | BLOCKED |
| AK-60.04 | Documentar operadores, rotinas de recovery e Product Gate | Runbooks, evidências, WBS mestre atualizada; Managers sem bypass, SQL 002 bloqueada até #31 | AK-60.03 | BLOCKED |

**Gate G6:** aceitar arquitetura em homologação apenas com evidência de integração e rollback. Produção/piloto comercial exigem WBS 95, não decorrem automaticamente desta entrega.

## Caminho crítico de implementação

```text
AK-00 (inventário/segurança)
     ↓
AK-10 (manifest V2 + catálogo + enabled gate) ────────┐
     ↓                                                │
AK-20 (Account & Access / FGA reconciliation)          │
     ↓                                                │
AK-30 (installer + ledger + schemas + PostgreSQL ACL) ←┘
     ↓
AK-40.01 Organizations → 40.02 CRM → 40.03 Inbox → 40.04 WhatsApp → 40.05 Support
     ↓
AK-50 (read models / integrações / uninstalls seguros)
     ↓
AK-60 (CI/e2e/operacional/rollback e Product Gates)
```

### Critérios de aceite transversais

1. **Segurança:** identidade OIDC correta; tenant/org/workspace/Módulo/FGA sempre verificados, token de Manager negado no tenant; autorização entre módulos não herdada por owner da conta.
2. **Dados:** um database por tenant; cada módulo opcional tem seu schema e ledger; sem dependência implícita em `public`, sem SQL gerado a partir de request; objetos `_syndes` acessíveis somente ao instalador.
3. **Isolamento:** tenants A e B com conjuntos de módulos diferentes; schemas ausentes para não contratados; POST/GET e workers negados mesmo se grant FGA antigo existir.
4. **Integridade:** migração repetível, checksum estável, foreign keys e views com dependências explícitas, backup/rollback; nenhum drop destrutivo automático.
5. **Contrato:** `ModuleRegistry` resolve dependências; `SyndesPlugin` V2 traz ID, versão, schema, permissions, migrations e read models sem duplicar engines externos.
6. **Qualidade:** node TS, PG17 descartável, Go quando aplicável, browser, auditoria e restore; CI não é prova de produção; cada item só passa a DONE com link de commit e run.
7. **Governança:** não modificar `main` protection; não reinventar elementos de frontend ou alterar workflows estruturais fora da frente delegada.

### Informações ainda a levantar no F0

- Existência e retenção de dados de demo/tenant Syndes e permissões reais por banco; nenhum reset presumido.
- Dependências SQL completas entre schemas de domínio e Platform; especialmente FK, SECURITY DEFINER, funções hard-coded `public` e WhatsApp Go.
- Modelo preciso de versionamento/entitlements ligados a assinatura comercial futura; evitar conflar assinatura com FGA.
- Condições de instalabilidade sem dinamismo Nest: package implantado no host mas desabilitado em tenant é permitido; schema físico ausente exige gate antes de selecionar DB.
