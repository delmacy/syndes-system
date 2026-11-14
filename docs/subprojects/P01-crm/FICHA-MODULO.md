# P01 CRM — Ficha Mestre (template congelado v1.0.0)

> **Instância documental 14/11/2026.** Baseline de leitura: `39f434e5720653eda8af2e3b2a0fa60d1a119cdd`. A auditoria CRM de **12/11/2026** teve **29 PASS locais** no checkout `b452a03e`; esses testes **não** foram reexecutados agora. Não há alegação de integração real, deploy, aceite, alteração de runtime ou Product Gate.

## 00 · Identificação e confiabilidade

| Campo | Estado |
|---|---|
| ID, owner e fonte | P01 CRM — `modules/core-crm` · [catálogo](../../../catalog/work-units.json) |
| Natureza | Domínio TypeScript, plugin NestJS, PostgreSQL de tenant, Workspace consumidor |
| Objetivo | Pessoas, empresas comerciais, relacionamentos, notas, tags, canais, histórico |
| Exclusões | Platform Organization/Control, Keycloak/FGA, Inbox/WhatsApp runtime e funil/protocolo P05 |
| Código | 30 rotas, 9 tabelas, 18 ações identificadas |
| Testes | 29 PASS **históricos**; não executados neste incremento |
| Integração, deploy, operação e aceite | **NÃO HOMOLOGADOS** |
| Template | [Modelo Universal v1.0.0 congelado](../../standards/TEMPLATE-FICHA-MODULO.md) |

## 01 · Fontes canônicas e continuidade

[ESCOPO](ESCOPO.md) (requisitos aprovados e capítulos), [REFERÊNCIA TÉCNICA](REFERENCIA-TECNICA.md), [INVENTÁRIO](INVENTARIO-INTEGRAL.md), [DIAGRAMAS](DIAGRAMAS.md), [MATRIZ](MATRIZ-ACOES.md), [STATUS](STATUS.md), [EVOLUÇÃO](EVOLUCAO.md), [OPERAÇÃO](OPERACAO.md), [HISTÓRICO](HISTORICO.md), [PROJEÇÃO](PROJECAO.md), [IMPLEMENTAÇÃO](IMPLEMENTACAO.md), `AGENTS.md` global/local e `modules/core-crm/src`. A ficha referencia essas fontes, **não** cria segunda especificação.

## 02 · Missão, atores, histórias e regras

Atores: operador autorizado, administrador do tenant conforme grants, service principal de integração e Platform Manager **sem acesso automático a CRM tenant**. Casos UC-01 (cadastro/relação/nota/tags/archive/CSV) e UC-02 (identidade WA) em [jornadas](chapters/03-publico-atores-e-jornada-principal.md). Histórias descritivas e edge cases por ação para revisão, não novos requisitos aprovados. `crm_organizations` ≠ Platform Organization; funil/protocolo pertencem a P05.

## 03 · Funções e ações

| Função | Fichas por ação |
|---|---|
| cadastros | [Criar contato](acoes/crm-create-person.md) · [Consultar e pesquisar contatos](acoes/crm-search-person.md) · [Cadastrar organização comercial](acoes/crm-create-organization.md) · [Vincular pessoa e organização](acoes/crm-link-organization.md) · [Atualizar e arquivar contato](acoes/crm-maintain-person.md) · [Consultar, editar e arquivar empresa](acoes/crm-manage-organizations.md) · [Consultar e desvincular relacionamentos](acoes/crm-manage-links.md) · [Gerenciar tags de contatos](acoes/crm-tags.md) · [Consultar e vincular perfil de funcionário](acoes/crm-employees.md) |
| atendimento | [Registrar nota de atendimento](acoes/crm-create-note.md) · [Consultar histórico e timeline](acoes/crm-read-timeline.md) |
| validacoes | [Validar autorização e isolamento](acoes/crm-authorization.md) · [Consultar possíveis duplicidades](acoes/crm-duplicates.md) |
| integracoes | [Consultar contrato público do CRM](acoes/crm-public-contracts.md) · [Vincular e consultar identidades de canal](acoes/crm-channels.md) · [Importar e exportar contatos CSV](acoes/crm-csv.md) · [Resolver identidade de WhatsApp por eventos](acoes/crm-identity-events.md) |
| evolucao | [Homologar jornada CRM](acoes/crm-product-gate.md) |

A [matriz](MATRIZ-ACOES.md) associa essas ações às rotas e aos diagramas. IDs devem permanecer estáveis.

## 04 · Arquitetura, diagramas e cobertura

[DIAGRAMAS.md](DIAGRAMAS.md) tem 6 diagramas: arquitetura, ERD, sequência de criação, eventos, segurança e gates. `crm_audit` é a nona tabela descrita fora do ER visual. Diagramas UML/BPMN/estados adicionais só se necessários e aprovados como documentação de uma ação; não modificar template congelado. Diagrama de código **não é prova de runtime**.

## 05 · Implementação, stack e exports

TypeScript 5.9, `CrmService`, `CrmExtras`, `PgCrmRepository`, `CrmDefaultContextGuard`, `CrmHttpModule`, `CoreKernel.execute`. Exports oficiais `@syndes/core-crm` e `@syndes/core-crm/plugin`; conferir `package.json#exports`. 84 ocorrências de assinaturas no [inventário](INVENTARIO-INTEGRAL.md) incluem declarações internas/duplicadas; **não são 84 APIs públicas**.

## 06 · Interfaces HTTP e eventos

[30 endpoints HTTP](INVENTARIO-INTEGRAL.md) sob `/v1/tenants/:tenantId/crm` mapeados em [18 fichas](MATRIZ-ACOES.md); permissões dependem do recurso real. Eventos `inbox.participant.observed.v1`, `crm.person.resolved.v1`, `crm.person.review_required.v1` pertencem a contratos versionados e integração opt-in. Não inferir HTTP operacional ou outbox própria a partir de código.

## 07 · Persistência, schemas e integridade

**Tenant DB:** `crm_people`, `crm_organizations`, `crm_person_organizations`, `crm_audit`, `crm_tags`, `crm_person_tags`, `crm_notes`, `crm_employees`, `crm_channel_identities`. Migrations 001–003, 53 declarações lexicais de colunas; verificar constraints SQL reais. **Control/Manager DB: nenhuma tabela CRM própria**. Aplicação de migração, retenção, privacidade e restore no ambiente real: **PENDENTE DE EVIDÊNCIA**.

## 08 · Comandos, eventos, jobs e integrações

`CrmWhatsAppIdentityPolicy.decide/validateLink` exige tenant, organization, workspace e conversation coerentes; consumer opt-in publica resolução ou revisão (`ambiguous`, `missing_identity`, `conflicting_link`), sem criar Person nem escrever diretamente no Inbox/WhatsApp. [Ficha de identidade](acoes/crm-identity-events.md). Grants de serviço, replay, cutover e revisão humana operacional pendentes.

## 09 · Autenticação, autorização e isolamento

JWT no Host, membership e contexto confiável, `CoreKernel.execute`/OpenFGA por ação e tenant DB compatível. `legacy|enforce`, SQL 002 e multi-org são condições de rollout, não operação homologada. [Matriz por recurso](MATRIZ-ACOES.md) e [ação de IAM](acoes/crm-authorization.md). Negativas 401/403/503 e tenant A/B ainda requerem E2E real.

## 10 · Frontend, experiência e acessibilidade

A01 Workspace usa `apps/workspace-web/src/features/crm.tsx` e `crm-person-detail.tsx`. A ficha não cria frontend CRM separado nem fornece acesso Manager→tenant. Browser real com JWT/FGA, estados de erro, teclado, responsividade e jornada fim a fim: **NÃO HOMOLOGADOS**. UI não substitui guard backend.

## 11 · Infraestrutura, ambientes e deploy

O CRM é plugin montado no Core Host A04, não serviço isolado garantido. Tenant DB via provider confiável; Context Gate, módulo ENABLED e IAM dependem do ambiente. Imagem/digest em produção, migrations efetivas, backup, restore, release e rollback: **NÃO VERIFICADOS**. Não publicar secrets, DSNs nem endereços internos.

## 12 · Operação, incidentes e recuperação

[OPERACAO.md](OPERACAO.md) é índice de gates, **não runbook homologado**. Health, SLI/SLO, logs sem PII, métricas, incidentes, backup/restore e rollback ainda necessitam owner e evidência. CI verde não é deploy.

## 13 · Testes, qualidade e critérios de aceite

Testes locais 29 PASS em 12/11 no checkout `b452a03e`; fontes `crm.test.mjs`, `extras.test.mjs`, `context-guard.test.mjs`, `context-propagation.test.mjs`, `scope-query.test.mjs`, `capabilities.test.mjs`. Fichas individuais têm cenários Given/When/Then **propostos**, não executados. E2E Keycloak/FGA A/B, PG, restore e Product Gate **abertos**.

## 14 · Requisitos não funcionais

Isolamento tenant/org, validação, fail-closed e CSV (1 MiB, até 500 entradas e 1000 exportadas) são verificáveis no código. SLO, custo/capacidade, conformidade LGPD de ambiente, retenção e acessibilidade medida: **PENDENTE**, sem inventar metas. Fonte em `src/csv.ts`, `src/validation.ts`, `src/context-guard.ts`.

## 15 · Dependências e impacto externo

A04 Host/A08 Kernel (contratos), C01 Control/P04 Organizations (tenant e membership), C03 Keycloak/C04 OpenFGA/C05 OpenBao, A01 Workspace, P02 Inbox/P03 WhatsApp/C06 Event Bus, P05 gestão de atendimentos. Consultar owner e contrato público antes de mexer em API, SQL, UI, event payload ou auth; não editar código privado alheio.

## 16 · Roadmap, WBS e prioridades

[WP-50](EVOLUCAO.md) valida CRM/Inbox/WhatsApp Basic; [WP-55](EVOLUCAO.md) é P05 (funil), não ownership P01; [WP-60](EVOLUCAO.md) trata multi-org condicionado. P01-VAL-01/02/03 são **tarefas candidatas não atribuídas**. Ordem sugerida: HTTP+IAM real A/B → identidade WA e revisão → UI/restore/aceite.

## 17 · Decisões, observações e mudanças

Sem novas funcionalidades aprovadas por esta ficha. Questões: CPF/CNPJ no código valida **comprimento, não dígito verificador**; não mesclar automaticamente duplicados; EmployeeProfile CRM↔P04; fluxo humano de `review_required`; rollout multi-org. Rascunhos `localStorage` da Biblioteca não constituem decisão persistente.

## 18 · Pacote de contexto do agente

`P01 + actionId + subtópico + observação + SHA` → ler [ação](MATRIZ-ACOES.md), ESCOPO, STATUS, AGENTS, contratos e testes próprios. Planejar sem executar; implementar só com decisão e paths aprovados, gates e testes reais. Atualizar código, documento, diagrama, WBS e STATUS na mesma entrega.

## 19 · Checklist de atualização refletida no código

1. Registrar ID da ação, requisito/decisão aprovada, paths permitidos e exclusões.
2. Conferir commit/branch, owner, consumidores, compatibilidade e schema.
3. Cobrir happy path, edge cases, 401/403, tenant A/B, retry/idempotência e failures pertinentes.
4. Implementar somente o aprovado; executar testes e registrar PASS/FAIL/SKIP e ambiente.
5. Atualizar `ESCOPO` se houver decisão, `REFERENCIA`, fichas, diagramas, `STATUS` e `EVOLUCAO`.
6. Não declarar integrado/operacional/aceito apenas por commit ou testes unitários.

## 20 · Particularidades opcionais de CRM

Pessoa `crm_people` não é login Keycloak; perfil `crm_employees` é legado em reconciliação; empresa `crm_organizations` não é Platform Organization. Possíveis duplicatas não autorizam merge. DisplayName de canal não substitui nome confirmado. WhatsApp atual prioriza texto; mídia/atendimento são de outros owners.

## 21 · Histórico e próximo checkpoint

| Data | Fonte | Resultado | Limite |
|---|---|---|---|
| 12/11/2026 | [STATUS](STATUS.md) | 29 PASS locais `b452a03e` | Sem Product Gate |
| 13/11/2026 | [INVENTÁRIO](INVENTARIO-INTEGRAL.md) e [DIAGRAMAS](DIAGRAMAS.md) | 30 rotas, 9 tabelas, 6 diagramas | Sem deploy |
| 14/11/2026 | Esta Ficha Mestre e [matriz](MATRIZ-ACOES.md) | 18 fichas por ação | Apenas documentação; sem runtime |

**Próximo marco candidato, sem aprovação:** P01-VAL-01, validação do CRM com JWT/FGA, ambiente autorizado e dois tenants.
