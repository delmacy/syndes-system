# AK-10.03 — Entitlements e intenções de instalação por tenant

**Estado:** candidato isolado, testado em PostgreSQL 17 descartável. Não aplicado ao Control DB operacional nem integrado na main. **Depende das PRs #66 e #69**, no âmbito de AK-10.03/G1 da WBS técnica da PR #65.

## Separar estados e autoridades

| Conceito | Autoridade | Semântica nesta entrega |
|---|---|---|
| available | Catálogo AK-10.02 + pacote compilado confiável | Aprovação de versão/schema/dependências, sem acesso a tenant |
| entitled | public.tenant_module_entitlements (Control DB) | granted + prazo válido no relógio PostgreSQL; pode ser suspended/revoked |
| requested | public.tenant_module_installs (Control DB) | Intenção de instalar versão aprovada; exige entitlement próprio e de dependências |
| installed | Instalador AK-30 + ledger SQL | Reservado no modelo; **não pode ser marcado** por comando desta entrega |
| enabled | Instalador verificado + Host AK-10.04 | Reservado; sem ativação nesta entrega |
| suspended | Entitlement ou intenção administrativa | Negado na projeção; runtime legado só será cortado em AK-10.04 |
| retired | Intenção de instalação | Retirada lógica terminal, sem apagar dados ou schema |
| OpenFGA, OIDC, memberships | Control DB, Keycloak e OpenFGA | Nem owner global nem estado de módulo concedem permissão operacional |

O Control DB é syndes_control. O schema public aqui contém **metadados globais**, não tabelas de domínio dos tenants.

## Persistência, transições e confiança

Candidato SQL: infra/postgres/bootstrap/control-module-lifecycle.schema. **Não está registrado em bootstrap**.

- Tabelas tenant_module_entitlements, tenant_module_installs e tenant_module_audit, com FKs e ON DELETE RESTRICT para preservar vínculos.
- **Idempotência:** UUID request_id por comando, ator técnico e motivo. A chave (tenant_id,request_id) é única. Replay idêntico retorna resultado original, mesmo depois de nova transição, sem outro evento. Reuso com payload diferente retorna erro. Lock transacional serializa comandos concorrentes do mesmo tenant/módulo.
- Comandos de entitlement: grant, suspend, resume, revoke. Prazo expirado não pode ser prorrogado por resume; grant pode renovar com novo prazo válido. Tenant suspenso não recebe novas concessões.
- Intenção de instalação: request exige entitlement válido do módulo, versão aprovada e entitlements válidos das dependências para o **mesmo tenant**. Suspend, resume (volta a requested) e retire registram auditoria. Retired é terminal. Nenhuma API install, enable ou drop é exposta.
- A tabela de instalações reserva campos para digest, versão instalada e verificação; funções **nunca preenchem esses campos**. Um digest na tabela não é prova de ledger nem autorização operacional.
- Apenas a role técnica NOLOGIN syndes_module_operator recebe EXECUTE das duas funções de comando. A role syndes_core tem SELECT sobre entitlements/installs, sem DML, sem executar comandos nem ler audit. A trilha audit tem trigger contra UPDATE/DELETE. Funções são SECURITY DEFINER, sem SQL dinâmico, search_path=pg_catalog, com tabelas qualificadas; owner/role precisam de revisão antes de operação persistente.
- O actor_id fornecido é atestado somente pelo **futuro serviço administrativo autenticado**; estas funções não validam OIDC. A role NOLOGIN não deve ser atribuída a pessoas ou clientes. Uma futura Account & Access API deverá validar identidade, conta, privilégio e auditar antes de executar. Nenhum HTTP é adicionado nesta PR.

## Kernel e Host

Tipos ModuleLifecycleRow, TenantModuleState, TenantModuleLifecyclePort e projectTenantModuleStates mantêm available/entitled/instalação separados. PgModuleLifecycle lê somente Control DB, exige UUID e tenant ativo, usa o relógio PostgreSQL para expiração e limita os resultados aos módulos realmente disponíveis no build.

O adapter é construído no composition root, **sem endpoint**. A projeção **não** implementa ModuleAccessPort: falta instalador/ledger, autorização de org/workspace, OpenFGA e bloqueio dos handlers/worker.

## Evidências / gates abertos

- PG17 em container descartável com tmpfs: DDL reaplicada, roles/ACL, A com CRM+Inbox+WhatsApp e B apenas CRM, tenant suspenso, validade expirada, suspend/revoke/retire, dependência faltante, versão não aprovada, replay após outra transição, concorrência de duas conexões, auditoria append-only, ativações proibidas e request malformado.
- Kernel/Host: testes de projeção, consulta parametrizada, estados distintos e falha fechada. Regressões de módulos verificadas separadamente.
- **AK-10.03 ainda PEND integração.** G1 não terminou: falta ledger, adapter Host/worker, API administrativa autorizada e E2E com Keycloak/OpenFGA/OpenBao reais.

## Próxima sequência

1. Integrar #66 → #69 → esta PR, com CI do SHA efetivamente consolidado.
2. AK-30.01/02: ledger _syndes + instalador versionado, com prova por tenant e módulo.
3. AK-10.04: ModuleAccessPort em Core Host e workers, deny para módulos sem instalação verificada e permissões reais.
4. AK-20: APIs administrativas autenticadas, revisão de privilégios, inventário, backup e rollback antes de DDL no Control DB operacional.

**Fora do escopo:** UX, billing, GitHub Actions, proteção main, schema Organizations, SQL 002, migração operacional e deploy.
