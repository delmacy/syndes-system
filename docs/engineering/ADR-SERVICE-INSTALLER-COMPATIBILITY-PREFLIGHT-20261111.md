# ADR — Gate de compatibilidade do Service Management com o instalador e Control Plane

**Data:** 2026-11-11 · **Estado:** diagnóstico histórico concluído. **Remediação de código SM-03C implementada**, descrita em [ADR-SERVICE-CANONICAL-INSTALLER-SM03C-20261111.md](ADR-SERVICE-CANONICAL-INSTALLER-SM03C-20261111.md); somente ativação operacional permanece bloqueada.

## Contexto e decisão

As PRs #93, #95, #96 e #97 entregaram, respectivamente, domínio, HTTP Nest opt-in, equipes Workforce e consulta Inbox por conversa para Gestão de Atendimentos. Todos foram integrados sem ativação operacional. O próximo passo **não** é instalar essas migrations no tenant real: o contrato de publicação do módulo tem três incompatibilidades que impedem o instalador oficial de garantir rollback e auditoria.

1. **Identificador não interoperável:** o descriptor e pacote apresentam o módulo como `service-management`, aceito pelo `ModuleRegistry` e Host, que exigem ID igual ao slug do pacote. O **Control** (`public.module_catalog`, `tenant_module_entitlements`) e o **PgModuleInstaller** exigem identificadores compatíveis com `^[a-z][a-z0-9_]*$`. O ID com hífen não é catalogável. O instalador também exige `release.id === release.schema`. Não inventar um alias silencioso; qualquer migração de identidade deve conservar o isolamento FGA.
2. **Ownership físico do schema:** as migrations 001–003 criam as tabelas `service_*` **sem prefixo de schema**, e o código/SQL referenciam objetos sem qualificação. O instalador define `SET LOCAL search_path=pg_catalog` e verifica relações **no schema do módulo**, além do ledger `_syndes.module_migrations`. Sob o contrato atual, os objetos não atendem ao postcondition do instalador. Também é necessário qualificar explicitamente as FKs/joins para `public.platform_*`, `public.inbox_*` e `public.crm_*`.
3. **Transação do instalador:** os três arquivos SQL contêm `BEGIN;` e `COMMIT;` no corpo. O `PgModuleInstaller.apply` já abre uma transação controlada, registra migrações no ledger e faz commit atômico. Executar `COMMIT` embutido dentro da migração prejudicaria esse limite transacional; **não** contornar o instalador com execução direta de DDL.

Há ainda dependências operacionais independentes: migration manual Workforce `007_staff_roles_pre_release.sql`, SQL002 single-context, grants de origem/destino OpenFGA, Keycloak/OIDC real, installer identity least privilege, backup e restore **reais** validados e ativação explícita Control `ENABLED`.

### Remediação priorizada (SM-03C, [Issue #98](https://github.com/delmacy/syndes-system/issues/98))

1. Definir **um ID canônico instalável** e package slug compatível com o Host. Candidato: `attendances` / `@syndes/attendances`, preservando o nome do produto Gestão de Atendimentos e a URL pública `/service-management`. Exige revalidar **todos** os grants/recursos FGA e chamadas `executeModule`; o ID não deve ser aceito por transformação implícita do cliente.
2. Migrar 001–003 para **schema dedicado** idêntico ao ID, com SQL inteiramente qualificado e sem `BEGIN/COMMIT` internos. Preservar relações físicas e guards existentes, validação de Workforce 007 e o trigger append-only. Como não há migration operacional implantada, a correção é de compatibilidade de **código pré-release**, não backfill de dados reais. Não renomear nada no tenant operacional.
3. Criar manifest de release revisado pelo operador, com version/checksum SHA256 por migration, `expectedRelations`, digest imutável da imagem e dependências Catalog/Inbox/Organizations aprovadas. Validar `PgModuleInstaller.plan/apply/verify` **somente em bancos PG17 descartáveis**, com negativos de rollback/DDL interrompido/checksum/ledger e disallow de papel runtime.
4. Somente depois planejar staging isolado com restore real, roles SQL, Control Module Catalog, entitlement e grants OpenFGA — **não** aplicar migration operacional nem marcar Product Gate sem evidência.

## Ferramenta executável e comportamento

`scripts/service-management/readiness_preflight.py` implementa um **gate fail-closed**:

```bash
python3 scripts/service-management/readiness_preflight.py --json
python3 -m unittest -v scripts/service-management/test_readiness_preflight.py
# Leitura OPCIONAL de catálogos locais de PostgreSQL, sem DDL ou mensagens:
python3 scripts/service-management/readiness_preflight.py --local-read-only --ack-catalog --json
# Sinaliza bloqueio em automações operacionais sem tocar CI/Actions:
python3 scripts/service-management/readiness_preflight.py --strict
```

O comportamento default é **offline**. O modo local apenas envia dois SELECTs estáticos dentro de `BEGIN TRANSACTION READ ONLY; ... ROLLBACK;` via `docker exec` no contêiner já aprovado `syndes-postgres-postgres-1`, com banco Control fixo e mapeamento de tenant validado a partir do registro canônico. Sem argumentos DSN/host/DB, sem SQL dinâmico, sem outputs de UUID/nome de database, sem corpo de mensagem, sem logs de stderr. Recusa flag de modo operacional desacompanhada de confirmação e termina com código 2 em `--strict`. **Jamais retorna `safe_to_install_or_enable=true` apenas por presença de tabelas.**

## Evidências observadas em 11/11/2026

- **14/14 testes unitários** do gate passaram, incluindo injeção de alvo, transação read-only, mapeamento invalidado, recusa de role superuser, redaction de segredo, flags de opt-in e impossibilidade de inventar aceite de backup/restore/FGA.
- **Código v0.3.0:** migrations 001–003 constam no plugin, mas ID incompatível, schema não próprio e transações SQL embutidas (três bloqueios estáticos).
- **Inventário local:** 1 banco de tenant registrado no Control; o Control ainda não possui tabelas `module_catalog`, `module_catalog_versions`, `tenant_module_entitlements` e `tenant_module_installs`. O tenant possui os objetos de base CRM/Inbox/SQL002, mas não os objetos Workforce 007, Service 001–003 ou `_syndes.module_migrations`. A role runtime consultada não é superusuário. Isso é um **inventário de schema**, não prova restore, grants, usuários ou fluxo autenticado.
- Nenhuma migration aplicada, nenhum dado empresarial copiado, nenhum container iniciado, nenhuma imagem de deploy criada, nenhuma alteração em `config/modules.json` e nenhum frontend modificado.
- A cobertura contínua de Service Management na CI continua separada na Issue #94, sob a frente de workflows. O gate de compatibilidade **não cria outro workflow**.

## Consequência estratégica

**MERGED ≠ INSTALLABLE ≠ ENABLED ≠ VERIFIED ≠ PRODUCT GATE.** O backend de funil existe, mas tentar contornar o instalador para mostrar o Kanban em dados reais criaria um segundo caminho de instalação sem ledger e sem rollback confiável. A próxima entrega técnica correta é a **compatibilidade canônica do módulo e seu manifest**, seguida por aprovação Control/restore de staging.
