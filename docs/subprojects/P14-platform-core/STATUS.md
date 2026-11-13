# P14 — Platform Core | STATUS

> **AUDITORIA TÉCNICA PARCIAL RECONCILIADA — 12/11/2026.** Revisão de fontes na worktree isolada baseada no SHA `e2c5194a97d48d8a809231d7088be668604725fb`. A unidade P14 **NÃO é pacote runtime próprio**: `modules/platform-core` contém apenas `AGENTS.md`. O Core executável é distribuído por A08 Kernel, A04 Host, Control/Identity/Authorization e módulos de domínio. Nenhuma alteração de runtime, banco, permissões, plugin ou produção foi feita nesta auditoria; revisão **sem implantação**.

## Checkpoint da auditoria

O levantamento complementa os testes históricos; o CI remoto verde não aprova operação ou perfis por instância.

## Matriz de estado com evidência

| Dimensão | Evidência verificada | Limite real |
|---|---|---|
| **Documentação P14** | **Auditoria parcial**: 8 capítulos, contratos, diagrama, WBS e referência técnica reconciliados | Aprovação de arquitetura pelos owners continua pendente |
| **Runtime P14** | **Não aplicável** — somente `modules/platform-core/AGENTS.md` | P14 não tem package JSON, controller, banco nem frontend |
| **Core Kernel A08** | `packages/core-kernel`: `CoreKernel`, `ModuleRegistry`, ports, `SyndesPlugin`, eventos tipados | Package privado; implementação e testes pertencem a A08 |
| **Core Host A04** | `apps/core-host/src/main.ts`, `module-host.ts`, adapters, `config/modules.json` | Loader fixo, **sem perfis por instância**. Serviço é dependência mas não plugin instalado |
| **Módulos e Tenant/Control** | Implementação dividida por owners; Control ENABLED, membership/FGA/tenancy e tenant DB têm gates próprios | `executeModule` é opt-in; não declarar enforcement universal sem testar cada endpoint |
| **Eventos** | `platform-event-*.ts`, contratos `platform-events.ts` e `control-plane-events.ts` identificados | Worker admission/composição manual **não são scheduler ativo nem DDL produtivo** |
| **Testes locais históricos** | Auditoria anterior do checkout `b452a03e`: Kernel **35 PASS**, Host **63 PASS, 19 SKIP** | Não reexecutados nesta revisão; skips não comprovam PG17/staging/Keycloak/FGA |
| **CI integrado da baseline** | [run 43345095065](https://github.com/delmacy/syndes-system/actions/runs/43345095065) — **24/24 jobs success** no SHA `e2c5194` | Ambiente de CI, não deploy/restore/Product Gate |
| **Perfis CMP** | [ADR de composição](../../engineering/ADR-COMPOSICAO-MODULAR-CORE-20261111.md) e [WBS](../../engineering/WBS-COMPOSICAO-MODULAR-CORE-20261111.md) | CMP-01/02 **PEND**; CMP-03/04 PEND, CMP-05/06/08/09 bloqueados; CMP-07 condicional, CMP-10 opcional |
| **Aceite/Operação** | Nenhuma homologação feita nesta frente | Release, backup/restore, service grants, rollout e Product Gate pendentes |

## Inventário verificável por owner

| Código/artefato | Natureza | Não permite concluir |
|---|---|---|
| `modules/platform-core/AGENTS.md` | Regras de plataforma e invariantes | Serviço P14 ativo |
| `packages/core-kernel/src/index.ts` e `package.json#exports` | Exports tipados do Kernel `@syndes/core-kernel` | SDK externo publicado |
| `apps/core-host/src/main.ts` e `module-host.ts` | Core Host NestJS, OIDC/FGA/Control e carregamento trusted | Perfil de imagem por instância |
| `apps/core-host/config/modules.json` | CRM, Inbox, WhatsApp, Organizations, Support | Instalação de Serviço ou `ENABLED` de tenant |
| `apps/core-host/src/platform-event-*.ts` | Publisher, dispatcher, worker admission e batch opt-in | Worker automático ou scheduler homologado |
| `docs/engineering/ADR-COMPOSICAO-MODULAR-CORE-20261111.md` | Decisão de evolução por perfis | Schema CMP-02 implementado |

## Bloqueios e lacunas

1. **CMP-01/02:** matriz de ports/dependências com sign-off e schema de profile validado offline ainda pendentes. A auditoria documental não conclui CMP-01 automaticamente.
2. **CMP-03–09:** duas composições independentes, imagem mínima, checksums, entitlements por instância, ingress, worker ownership, segurança e rollback **não comprovados**.
3. **Serviço Basic:** package `@syndes/service` é dependência do Host, mas não está em `config/modules.json`; módulos precisam ser montados/ENABLED com grants e Product Gate específicos.
4. **Eventos:** migrations de tenant/Control, FGA service grants, projetor único WhatsApp, backup/restore e worker operacional dependem de gates separados.
5. **Testes de integração reais:** resultados históricos com SKIP não servem como aceite de DB, tenant, FGA/Keycloak ou instalação; CI atual só comprova seu próprio SHA.
6. **Governança:** não transferir API, SQL, frontend, decisões de instalação ou produto dos owners A04/A08/C01/etc. para P14.

## Progresso documental, WBS e próximo checkpoint

A P14 **já era uma das 10 unidades com auditoria parcial** do plano. Esta revisão substitui placeholders por análise rastreável; **não aumenta a contagem de 10 nem reduz os 47 baselines**. WBS principal: 00.01, 50.01, 50.08, 55.03, 70.09 e 95.01. Especializada: CMP-01–10, sem promoção de tasks.

- [Escopo](ESCOPO.md): requisitos, capacidades, contratos e diagramas por owner.
- [Referência técnica](REFERENCIA-TECNICA.md): símbolos e endpoints reais, pertencentes a Kernel/Host.
- [WBS/EVOLUÇÃO](EVOLUCAO.md): workpackages candidatos e bloqueios.
- **Próximo candidato técnico:** validar CMP-01 (matriz de port/adapters/consumers e testes de fronteira) e depois especificar CMP-02 offline, sob autorização do owner. Nada de perfil/projeto dedicado em runtime antes de CMP-03+ e gates operacionais.
- **Próxima unidade documental no plano:** I02 — Hospedagem e ambientes.

| Data | SHA e ambiente | Comprovação | Não verificado |
|---|---|---|---|
| 2026-11-12 | `b452a03e`, DevServer01 | Testes locais históricos Kernel 35, Host 63; 19 skip | Deploy/staging/CI desse SHA |
| 2026-11-12 | `e2c5194a97d48d8a809231d7088be668604725fb`, CI remoto | [24/24 jobs success](https://github.com/delmacy/syndes-system/actions/runs/43345095065) | Produto/restore/rollback/profile operacional |
| 2026-11-12 | `e2c5194`, worktree documental P14 | Reconciliação estática de código e política, sem mutações de runtime | Aprovação dos contratos e Product Gate |

**Status final desta atividade: auditoria documental parcial; CI verde da baseline; P14 não é serviço e perfis CMP não estão operacionais.**
