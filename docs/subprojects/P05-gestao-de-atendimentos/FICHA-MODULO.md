# P05 — Ficha Mestre de Gestão de Atendimentos

> **Template universal congelado v1.0.0 · instância piloto em 16/11/2026.** Evidência: leitura das fontes da `main` `1cf48cc0a1281017ac58f7b9b9747f663109e151`, **sem execução de testes, migration, deploy, grants ou Product Gate**. O [STATUS](STATUS.md) diz "SEM AUDITORIA FUNCIONAL"; esta ficha aponta código identificado e lacunas, não revoga esse estado.

## 00 · Identificação, versão e estado

| Campo | Valor e evidência |
|---|---|
| Unidade | P05 — Gestão de Atendimentos; owner `modules/service-management` |
| Manifesto | `@syndes/service` v0.3.0, TypeScript 5.9 e NestJS |
| Escopo | [ESCOPO.md](ESCOPO.md) é **RASCUNHO NÃO APROVADO** |
| Código | 12 rotas declaradas no `ServiceManagementController` |
| Banco | Schema `service` do Tenant DB, 3 migrations versionadas |
| Testes | 3 arquivos identificados, **não executados nesta revisão** |
| Deploy, operação e homologação | **NÃO VERIFICADOS / NÃO HOMOLOGADOS** |
| Fonte da leitura | `1cf48cc0a1281017ac58f7b9b9747f663109e151` |
| Template | [Modelo v1.0.0](../../standards/TEMPLATE-FICHA-MODULO.md), inalterado |

**Síntese:** P05 implementa em código um funil simples, abertura de protocolos, movimentação de etapas, atribuição, transferência de equipe, leitura de quadro/histórico e encerramento. Isso não prova módulo instalado nem grants efetivos.

## 01 · Fontes canônicas e continuidade

| Fonte | Finalidade |
|---|---|
| [ESCOPO](ESCOPO.md) e [capítulos](chapters/01-missao-objetivos-e-fronteiras.md) | Requisitos e decisões, ainda não aprovados |
| [Matriz de 12 ações](MATRIZ-ACOES.md) | HTTP, métodos, recursos e limites |
| [Referência técnica](REFERENCIA-TECNICA.md) | Índice atual a aprofundar, sem substituir código |
| [service.ts](https://github.com/delmacy/syndes-system/blob/1cf48cc0a1281017ac58f7b9b9747f663109e151/modules/service-management/src/service.ts) | Regras de domínio e SQL |
| [controller.ts](https://github.com/delmacy/syndes-system/blob/1cf48cc0a1281017ac58f7b9b9747f663109e151/modules/service-management/src/controller.ts) | Rotas, autenticação e erros |
| [plugin.ts](https://github.com/delmacy/syndes-system/blob/1cf48cc0a1281017ac58f7b9b9747f663109e151/modules/service-management/src/plugin.ts) | Exports, dependências e migrations |
| [STATUS](STATUS.md), [EVOLUÇÃO](EVOLUCAO.md), [OPERAÇÃO](OPERACAO.md) | Evidências, WBS e limites |
| `AGENTS.md` global e local | Regras de ownership e edição |

Uma ficha é índice de contexto; não redefine o contrato aprovado em outro owner.

## 02 · Propósito, atores, histórias e regras

**Missão:** conduzir atendimentos por funil e protocolo independente da conversa, preservando etapa, responsabilidade, equipe e trilha auditável. **Atores:** operadores humanos associados a tenant, organização de plataforma e workspace ativos; papéis de viewer/editor/admin somente quando autorizados também pelo FGA/Kernel.

**História descritiva para análise, não requisito aprovado:** como operador autorizado, quero abrir um atendimento, atribuir o responsável e mover entre etapas para registrar seu progresso sem editar o cadastro canônico no CRM.

**Fronteiras:** CRM P01 possui contato; Inbox P02 possui conversa; Workforce/P04 possui equipes/membership; P05 possui funil, atendimento e seus eventos de auditoria.

## 03 · Funções, capabilities e ações

| Função | Ações no código | Estado |
|---|---|---|
| Definir funil | Listar publicados, publicar definição com 2–8 etapas | `listFunnels`, `publishSimpleFunnel` |
| Protocolos | Abrir idempotentemente, consultar e visualizar eventos | `open`, `get`, `history` |
| Etapas | Avançar/retroceder para etapa vizinha com versão CAS | `advance` |
| Pessoas e equipes | Atribuir pessoa, listar equipe, transferir com supervisor | `assign`, `listTeams`, `transferTeam` |
| Visões | Quadro e Inspector de atendimentos por conversa | `board`, `byConversation` |
| Resultado | Fechar atendimento em estágio terminal | `close` |

**[Matriz exata dos 12 endpoints](MATRIZ-ACOES.md).** Fichas individuais completas A–J por ação ainda são **PENDENTES**. Testamos aqui a cobertura de Ficha Mestre, sem inventar 12 fichas homologadas.

## 04 · Arquitetura e matriz de diagramas

| Tipo | Fontes para produzir o diagrama | Estado |
|---|---|---|
| Contexto C4 | P05, Workspace, CRM, Inbox, Workforce, Host e PostgreSQL | PENDENTE |
| Componentes | `ServiceManagementHost`, `ServiceFunnelService`, Kernel, TenantTransaction | PENDENTE |
| Sequência | `open` com idempotencyKey, `advance` com CAS, `transferTeam` com grants | PENDENTE |
| Estados | `draft/published` para funil e `open/closed` para protocolo | PENDENTE |
| ERD | SQL 001–003 e relações com entidades públicas | PENDENTE |
| Segurança | JWT/ENABLED/FGA/membership/equipes | PENDENTE |
| Implantação | plugin opt-in, grants, migrations e rollback | NÃO HOMOLOGADO |

A [matriz](MATRIZ-ACOES.md) cataloga os diagramas necessários. Não confundir desenho proposto com estado implantado.

## 05 · Implementação, stack e fronteiras

Pacote `@syndes/service` v0.3.0; TypeScript 5.9; NestJS 12. Exporta `.` e `./plugin` pelo manifesto. Símbolos: `ServiceFunnelService`, `ServiceManagementHost`, `ServiceManagementController` e `syndesPlugin`. O plugin declara dependências `platform`, `organizations`, `crm`, `inbox`. Não importar internals fora dos exports nem considerar que a construção de classe ativa o módulo.

## 06 · Contratos HTTP e erros

Base `/v1/tenants/:tenantId/service-management`; **12 rotas GET/POST/PATCH**, mapeadas em [MATRIZ-ACOES.md](MATRIZ-ACOES.md). Host verifica JWT (401); recursos inválidos retornam 400, falta de autorização 403, conflito de CAS/FK 409 e dependência indisponível 503 conforme controller. Headers `x-syndes-organization-id` e `x-syndes-workspace-id` são seletores: serviço valida memberships, não se baseia apenas em informação do frontend. Disponibilidade HTTP real **NÃO COMPROVADA**.

## 07 · Dados, integridade e migrations

Schema `service` no Tenant DB: `service_funnels`, `service_funnel_stages`, `service_attendances`, `service_attendance_events` referenciados no código. Migrations declaradas `001_service_funnels.sql`, `002_service_team_transfer.sql`, `003_service_conversation_inspector.sql`. Tabelas públicas de equipe, membership, workspace e Inbox pertencem a **outros owners**. Abertura usa chave idempotente, alterações usam versão CAS e SQL triggers registram ator. Migrações efetivamente aplicadas/backup/restore: **A VERIFICAR**.

## 08 · Eventos, idempotência, transações e integrações

Abertura `open` impede protocolo duplicado para a mesma `request_key` e devolve resultado anterior somente se payload e ator coincidirem. Mudança com `expectedVersion` incorreta dá conflito, sem gravar atualização antiga. Auditoria SQL append-only registra transições. Inspector por conversa requer autorização conjunta de **Inbox e Service**, não grava mensagens. Não foi identificado um producer de Event Bus P05 neste recorte; portanto **NÃO IDENTIFICADO**, não inexistência garantida.

## 09 · Segurança, tenancy e papéis

| Ator e recurso | Condição de acesso |
|---|---|
| Viewer (humano e membro ativo) | Leitura de funil, quadro, protocolo, histórico e equipes se FGA permite |
| Editor (membro ativo) | Abertura/movimentação/atribuição/fechamento com grants |
| Admin e supervisor | Publicação de funil e transferência com FGA de ambas as equipes |
| Contexto | tenant, organization e workspace UUID validados; SQL filtra membership ativa |
| Módulo | `CoreKernel.executeModule` exige admission/ENABLED + recurso autorizado |
| Negativas | Tenant A/B, actor de serviço, workspace inativo, DB mismatch e falha FGA devem falhar fechado |

Grants efetivamente provisionados em ambiente **NÃO HOMOLOGADOS**. UI de atribuição não é concessão de permissão.

## 10 · Frontend, navegação e experiência

O portal é **documentação**, não a UI operacional P05. Há métodos para quadro e Inspector no backend, mas a WBS 55.05 registra UI/kanban e Product Gate ainda dependentes. Estados a validar: vazio, carregamento, versão concorrente 409, 403 por equipe, 503, atualização em tempo real, teclado e responsividade. Não inventar telas ou duplicar componentes de A01 Workspace.

## 11 · Infraestrutura, instalação e ambientes

Plugin declara três migrations e recursos FGA, mas instalação em trusted Host, `ENABLED` e migrations aplicadas por ambiente não foram verificadas. O módulo não cria infraestrutura própria de segredo/autorização; esses serviços têm owners separados. Registrar digests, preflight, backup, rollback e configuração não sensível antes de deploy, sem publicar DSN, tokens, policies ou endereços internos.

## 12 · Operação, incidentes e recuperação

[OPERACAO.md](OPERACAO.md) é apenas índice operacional; **não runbook homologado**. Não foram comprovados health específico, SLI/SLO, logs seguros, auditoria efetiva em staging, restore, alertas ou rollback. Falha 409 por concorrência não deve virar repetição de gravação sem revalidar a versão.

## 13 · Testes, qualidade e critérios de aceite

| Arquivo no owner | Escopo de verificação esperado | Resultado nesta revisão |
|---|---|---|
| `test/service-validation.test.mjs` | Validações, funil, estados | NÃO EXECUTADO |
| `test/http-adapter.test.mjs` | API/auth HTTP | NÃO EXECUTADO |
| `test/service-funnels-pg17.test.mjs` | Testes de integração PostgreSQL | NÃO EXECUTADO |

**Cenários candidatos:** idempotencyKey com payload diferente; expectedVersion obsoleta; etapa não adjacente; fechar sem estágio terminal; equipe não staffed; transfer sem supervisor/FGA; Inspector sem grant Inbox; JWT inválido; tenant A/B real. Não alegar PASS sem logs e SHA.

## 14 · Requisitos não funcionais e limites

- Funil simples exige **2–8 etapas** distintas; último estágio terminal.
- Protocolo formatado `ATD-`, independente de vínculo opcional com conversa.
- Consultas limitadas no código: até 50 funis, 100 atendimentos no quadro, 200 eventos no histórico.
- Escrita usa versão CAS, chave idempotente e escopo triplo tenant/org/workspace.
- SLO, retenção LGPD, UX acessível verificada e capacidade em produção: **PENDENTES**.

## 15 · Integrações e análise de impacto

| Owner | Fronteira |
|---|---|
| A08 Kernel / A04 Host | Module admission, autenticação e provider de TenantTransaction |
| C01 Control / P04 Organizations e Workforce | Entitlements, memberships, equipes e supervisores |
| P01 CRM | Dados de pessoas e relacionamentos |
| P02 Inbox | Conversa opcional e Inspector somente leitura com dupla autorização |
| P03 WhatsApp | P05 não escreve mensagens |
| C03 Keycloak / C04 OpenFGA / C05 OpenBao | Identidade, autorização e segredos com owners próprios |

Alterar contratos externos exige acordo de owner e testes de consumidores.

## 16 · WBS, roadmap e prioridades

[EVOLUCAO.md](EVOLUCAO.md) documenta WP-55: SM-01 requisitos, SM-02 funil/protocolo, SM-03 plugin/Host/SQL, SM-04 equipes, SM-05 Inspector/kanban, SM-06 restore/E2E/Product Gate. WP-80 avançado é pós-MVP. Estados nessa WBS podem ser históricos; código em main **não** prova que etapa foi implantada. Próximo incremento candidato é auditar os 12 endpoints e migrations sem ativar serviços.

## 17 · Decisões e observações

**Nenhuma nova decisão foi aprovada nesta ficha.** Revisar política de publicação/edição de funil, eventual reabertura de protocolo, regras de associação com conversa, transferências entre equipes, UI do quadro e operações de revisão humana. Sem decisão explícita não alterar código, dados ou contratos de outros owners.

## 18 · Pacote de contexto para agentes

Entrada: `P05 + ação da matriz + subtópico + observação + SHA`. Ler AGENTS global/local, ESCOPO, STATUS, [MATRIZ](MATRIZ-ACOES.md), implementação e testes específicos. Planejamento propõe impacto/WBS e critérios **sem implementar**. Implementação requer decisão aprovada e arquivos autorizados, seguida de testes e documentação reconciliada.

## 19 · Checklist de atualização de código

1. Identificar ação e aprovação, arquivos do owner e contratos externos.
2. Confirmar branch/SHA, permissions, membership, módulos ENABLED e migrations aplicadas.
3. Reproduzir cenário principal e edge cases de CAS, FGA, idempotência e tenant A/B.
4. Implementar apenas o autorizado, testar unit/PG/E2E e registrar PASS/FAIL/SKIP.
5. Reconciliar STATUS, WBS, ficha, contratos e diagramas na mesma alteração.
6. Comprovar deploy, operação e Product Gate separadamente.

## 20 · Particularidades de Gestão de Atendimentos

Funil tem `draft/published` e protocolo tem `open/closed`; etapas e equipes possuem regras específicas. `expectedVersion` e request key protegem concorrência/retry, enquanto histórico append-only exige auditoria SQL. CRM não deve receber funil; Inbox não deve copiar protocolo; Workforce mantém ownership de equipe. Reabertura, construtor avançado, automações e CRM merge **não estão autorizados** por esta documentação.

## 21 · Histórico e próximo checkpoint

| Data | Alteração | Evidência / limite |
|---|---|---|
| 12/11/2026 | Estrutura P05 inicial | [STATUS](STATUS.md): sem auditoria funcional |
| 16/11/2026 | Leitura de serviço, controller e plugin | 12 rotas declaradas; não prova deploy |
| 16/11/2026 | Ficha Mestre e matriz para portal | Teste de documentação; nenhum teste de negócio executado |

**Próximo checkpoint sugerido:** auditar testes/migrations reais P05, validar integração Host + FGA + tenant A/B e registrar resultados no STATUS, com autorização de owners.
