# P01 — CORE CRM
## ESCOPO DE SUBPROJETO · REVISÃO PARA IMPRESSÃO

**Versão do rascunho:** 0.1 · **Data de referência:** 11/11/2026
**Estado da especificação:** EM DISCUSSÃO — NÃO APROVADA
**Subprojeto:** P01 · Categoria: Produto e integrações
**Proprietário lógico:** Core CRM · **Pacote:** `modules/core-crm`
**Código frontend consumidor:** `apps/workspace-web/src/features/crm.tsx`, `crm-person-detail.tsx`
**Host:** `apps/core-host` · **Kernel:** `packages/core-kernel`
**Documento de execução:** [STATUS.md](STATUS.md) · **Sprint:** [SPRINT.md](SPRINT.md) · **Código:** `modules/core-crm`
**Requisitos já existentes:** [Aceite CRM MVP](../../product/CORE-CRM-MVP-ACCEPTANCE.md) · [Fechamento frontend](../../product/CORE-CRM-FRONTEND-COMPLETION.md) · `modules/core-crm/AGENTS.md`

> **Leitura obrigatória do agente:** AGENTS.md da raiz → AGENTS.md do CRM → este ESCOPO.md → STATUS.md → contratos de código referenciados. Não transformar pendências de aceite em funcionalidades inexistentes; não presumir que código aprovado localmente está operacional para clientes.

---

## 1. Missão e resultado de negócio

O Core CRM constitui **a fonte canônica de cadastro e relacionamento básico de pessoas e organizações de contato comercial** no contexto de um tenant. Deve permitir encontrar, relacionar, atualizar, classificar e auditar informações de relacionamento utilizadas pelos fluxos de atendimento.

**Beneficiários:** operadores de atendimento, equipes comerciais, usuários administrativos do tenant e módulos consumidores autorizados.

**Resultado do MVP:** um operador autenticado localiza ou cadastra uma pessoa, associa a uma organização de cadastro, consulta suas identidades de canal, relacionamentos, notas e histórico, evitando perda ou sobreposição indevida de informações de contato.

**Não é CRM de vendas avançado:** pipeline de oportunidades, propostas, lead scoring, previsões, automações de marketing e campos dinâmicos avançados são pós-MVP, sem autorização de implementação neste subprojeto.

### Critérios de valor verificáveis

| OBJ | Resultado | Prova |
|---|---|---|
| P01-OBJ01 | Identificar pessoas e organizações sem cruzar tenants | Testes de isolamento A/B e consulta autenticada |
| P01-OBJ02 | Construir ficha completa e histórico de relacionamento | Jornada Workspace com dados reais e perfis distintos |
| P01-OBJ03 | Integrar contatos vindos de canais sem destruir dados confirmados | Eventos/contratos de identidade, conflitos e testes negativos |
| P01-OBJ04 | Importar/exportar registros com segurança e limites | CSV com validação, limites, escaping e FGA |
| P01-OBJ05 | Preservar compatibilidade com dependências opcionais | Teste de capabilities ausentes/desabilitadas |

---

## 2. Fronteiras e propriedade de dados

**O CRM é proprietário:** Person, Organization **de cadastro CRM**, vínculos Person↔Organization, Tag, Note, Timeline, EmployeeProfile enquanto perfil relacionado a Person e ChannelIdentity como referência externa.

**Não é proprietário:**
- `UserAccount`, usuários autenticados, issuer, tokens, permissões: Identity / Account Access / Core.
- Platform Organization, Organization operacional, Units, Workspaces, memberships e estrutura de equipe: **P04 Organizations & Workforce** e Control Plane. O termo `Organization` do CRM **não é** uma Platform Organization.
- Mensagens, estado de conversas, atribuições e filas: **P02 Inbox**.
- Sessões WhatsApp, mensagens do gateway, push names e receipts: **P03 WhatsApp**.
- Funis e protocolos de atendimento: **P05 Gestão de Atendimentos**.
- Conexões, segredos de banco e seleção de tenant: **Core Host / Tenant Database Provider**.
- Componentes visuais genéricos, tokens e sessões de frontend: **A07 Front Shared** e **A01 Workspace**.

**Invariantes:**
1. `Person != UserAccount`; `EmployeeProfile != Login`. Cadastro não concede identidade ou privilégio.
2. Nome confirmado no CRM não deve ser substituído silenciosamente por push name/business name externo.
3. Todo registro de negócio é isolado pelo tenant; escopo adicional de organization/workspace deve respeitar gates existentes, incluindo SQL002.
4. IDs e referências de outro tenant não revelam seus dados; FGA/membership passam antes de resolver banco.
5. Arquivar é operação de negócio; exclusão física exige procedimento específico e autorização.
6. Capabilities opcionais não se tornam pré-requisitos globais do CRM sem decisão explícita.
7. Inserção, alteração, vínculos e notas auditáveis precisam preservar a atomicidade da mutação e do registro correspondente.

---

## 3. Público, atores e jornada principal

| Ator | Necessidade | Autorização |
|---|---|---|
| Operador autorizado | Buscar, abrir ficha, criar notas e vincular contatos conforme escopo | JWT, membership, FGA por recurso |
| Administrador do tenant | Gerenciar cadastros e exportar conforme grants | Não implica permissão sobre outros tenants |
| Consumidor Inbox / WhatsApp | Relacionar identidade externa a pessoa canônica | Contrato e service grant verificado, não escrita arbitrária |
| Operador do Platform Manager | Administrar catálogo e entitlement | **Não recebe automaticamente acesso a dados CRM** |

### Jornada UC-01 — Cadastro e relacionamento

**Pré-condições:** tenant ativo e autorizado; módulo CRM efetivamente disponível/habilitado conforme gate aplicável; JWT verificado e papel com permissão de escrita.

1. Operador abre CRM no Workspace e consulta pessoas e organizações existentes.
2. Cadastra ou localiza uma organização de cadastro.
3. Cadastra ou localiza pessoa; se houver suspeita de duplicidade, recebe alerta sem mesclar automaticamente.
4. Relaciona pessoa e organização, adiciona tags e nota.
5. Consulta canais associados, histórico e vínculos.
6. Arquiva registro quando autorizado, preservando histórico e auditoria.
7. Exporta CSV quando tiver permissão.

**Falhas obrigatórias:** tenant errado, FGA negado/indisponível, contexto organizacional inválido, dados malformados, duplicidade de relacionamento, referência inexistente, falha de banco, requisição de CSV fora de limites.

**Pós-condições:** dados canônicos persistidos no banco correto, auditoria consistente, telas exibindo apenas operações autorizadas.

### Jornada UC-02 — Identidade observada em WhatsApp

**Pré-condições:** evento/contrato versionado entregue com escopo confiável e identidade verificável.

1. Contato externo é observado pelo fluxo WhatsApp/Inbox.
2. Política do CRM procura vínculo inequívoco dentro do escopo permitido (Platform Organization).
3. Quando inequívoco, publica `crm.person.resolved.v1`; quando ausente/ambíguo/conflitante, publica `crm.person.review_required.v1`.
4. Não cria pessoa provisória nem altera nomes confirmados sem procedimento aprovado.

**Limite atual:** política e testes sintéticos existem; workflow operacional de revisão de ambiguidades e escrita real não foi demonstrado como ativo.

---

## 4. Catálogo de capabilities propostas para rastreabilidade

Os IDs abaixo são **IDs de documentação candidatos**, não IDs já aceitos por uma API de capability. Validar com contratos reais antes de torná-los públicos.

| ID | Capability | Essencial / opcional | Propriedade | Contrato/artefato | Marco |
|---|---|---|---|---|---|
| P01-CAP01 | Pessoa: CRUD, busca e archive | Essencial | CRM | `contracts.ts`, `crm.controller.ts` | P01-M01 |
| P01-CAP02 | Organização de cadastro e relacionamentos | Essencial | CRM | `contracts.ts`, `postgres.ts` | P01-M01 |
| P01-CAP03 | Tags e classificações | Essencial | CRM | `extra.ts`, `postgres.ts` | P01-M01 |
| P01-CAP04 | Notas, timeline e auditoria | Essencial | CRM | `contracts.ts`, `extra.ts` | P01-M01 |
| P01-CAP05 | Normalização, busca e detecção de possíveis duplicados | Essencial | CRM | `validation.ts`, `crm.controller.ts` | P01-M01 |
| P01-CAP06 | CSV com limites e proteção contra fórmulas | Essencial | CRM | `csv.ts`, `crm.controller.ts` | P01-M01 |
| P01-CAP07 | ChannelIdentity vinculada à Person | Essencial no MVP de canais | CRM (referência, não sessão) | `extra.ts`, SQL 003 | P01-M02 |
| P01-CAP08 | EmployeeProfile associado à Person | Existente; integração Workforce opcional | CRM perfil, P04 diretório operacional | SQL 003, `extra.ts` | P01-M02 |
| P01-CAP09 | Contexto Organization/Workspace e seleção segura | Opcional conforme configuração aprovada | P04/Control | `context-guard.ts`, `scope-query.ts` | P01-M03 |
| P01-CAP10 | Reconciliação de identidade WA→CRM e review_required | Integração opcional | CRM + P03/P02/C06 | `whatsapp-identity-events.ts` | P01-M03 |
| P01-CAP11 | UI CRM no Workspace com capacidades efetivas | Essencial para aceite do produto | A01 + CRM API | `apps/workspace-web/src/features/crm*.tsx` | P01-M04 |

### Regra de progressão

Cada capability tem separadamente: **declaração, código, teste, integração, disponibilidade, autorização e aceite**. O estado de cada uma pertence ao `STATUS.md`.

O CRM pode possuir código de EmployeeProfile ou estrutura contextual sem ativar integrações Workforce/multi-org. **Não** eliminar nem ativar automaticamente tais capacidades. Dependências obrigatórias do manifesto `ModuleRegistry` e dependências opcionais de uma operação não são equivalentes.

### Depreciação ou redução

Antes de retirar ou alterar uma capability/coluna/endpoint/evento:
1. Mapear consumidores (Workspace, Inbox, WhatsApp, Service, workers, SQL e versões antigas).
2. Definir versão substituta e comportamento de convivência.
3. Migrar consumidores usando expand → migrate → contract; manter leitura de dados históricos.
4. Executar testes de compatibilidade, migrações e recuperação no ambiente autorizado.
5. Aprovar a remoção expressamente. Desabilitar uma UI ou flag **não** equivale a remover contrato ou apagar dados.

---

## 5. Contratos e interfaces oferecidos/consumidos

| Interface | Papel do CRM | Dono do outro lado | Referência |
|---|---|---|---|
| `/v1/tenants/:tenantId/crm/*` | Provedor HTTP NestJS | Core Host / Workspace | `src/crm.controller.ts` |
| `GET /crm/capabilities` sob prefixo tenant | Provedor de permissões efetivas por recurso | Core Kernel/FGA | `src/crm.controller.ts` |
| `SyndesPlugin`, `crmModule` v0.1.0 | Pacote contribuinte do Host | A04/A08 | `src/plugin.ts`, `src/service.ts` |
| `TrustedTenantDatabaseProvider` | Consumidor | Core Host + Kernel | `src/contracts.ts`, `src/runtime.ts` |
| `CoreKernel.execute/executeModule` | Consumidor de autorização | Kernel / Host | `src/service.ts`, `src/context-guard.ts` |
| `inbox.participant.observed.v1` | Consumidor lógico de observação de participante | Inbox / Event Platform | `src/whatsapp-identity-events.ts` |
| `crm.person.resolved.v1` | Publicador de resultado de resolução | Consumidores autorizados | `src/whatsapp-identity-events.ts` |
| `crm.person.review_required.v1` | Publicador de pendência de revisão | Consumidor/procedimento a definir | `src/whatsapp-identity-events.ts` |

**Regra:** eventos só são tratados como operacionais após comprovar publisher, outbox, dispatcher, consumidor e grant no ambiente real. Não presumir sucesso por existir type ou teste PG17 sintético.

**Permissões por recurso no plugin:** `crm:context`, `crm:people`, `crm:organizations`, `crm:relationships`, `crm:tags`, `crm:notes`, `crm:employees`, `crm:channels`; ações específicas do manifesto em `src/plugin.ts`. O frontend não substitui autorização HTTP.

**HTTP relevante:** people e organizations (listar/criar/consultar/editar/arquivar), vínculos, tags, notes, channels, employee, timeline, duplicates, imports/exports CSV e capabilities. Não duplicar assinatura de request/payload neste Markdown; conferir o controller antes de editar.

---

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

## 7. Frontend — apresentação ao usuário

**Aplicação canônica:** `apps/workspace-web`; arquivos de função `features/crm.tsx` e `features/crm-person-detail.tsx`. A antiga UI servida em `/crm` é legado de desenvolvimento, não o destino definitivo do produto.

### Telas e interações previstas pelo MVP

1. Listagem pesquisável de pessoas e organizações; paginação.
2. Cadastro e edição de Person/Organization, com validação de campos.
3. Ficha detalhada de pessoa: organizações, tags, notas, canais, perfil de funcionário, timeline.
4. Criação e remoção de vínculos com confirmação adequada; archive seguro.
5. Alertas de possíveis duplicidades; revisão manual, sem merge automático.
6. Importar/exportar CSV quando autorizado.
7. Mensagens de sucesso, carregamento, erro, vazio e acesso negado.
8. Interações responsivas e navegação por teclado; componentes visuais compartilhados quando aplicável.

**Regra de apresentação:** jamais inventar menus, botões, telas de review WA ou ações que não tenham requisito aprovado. Exibir ações conforme capabilities efetivas, mantendo backend como fonte de autorização. O estado `unauthorized` difere de `unavailable`.

### Evidências atuais e faltantes

A documentação existente descreve UI construída e testes de navegador com API/identidade mockadas, incluindo correções responsivas. **Não demonstra** homologação de dois usuários Keycloak reais, FGA real e tenant A/B com fluxo completo. Esse aceite pertence ao STATUS e aos gates da entrega.

---

## 8. Requisitos não funcionais e falhas

| Dimensão | Contrato de qualidade | Evidência exigida |
|---|---|---|
| Isolamento | Nenhuma operação CRM expõe registro de tenant B ao A | Teste A/B com roles e bancos distintos |
| Autenticação | JWT válido, issuer/audience e tenant membership | E2E com identidades reais |
| Autorização | Deny antes do lease DB quando necessário; FGA por recurso | Teste positivo, negativo, indisponibilidade FGA |
| Integridade | Atomicidade entre mutação e auditoria | Testes PostgreSQL e falhas simuladas |
| CSV | Limites, escaping e rejeição de entrada inválida | Unit e integração |
| Eventualidade | Idempotência/replay para eventos externos | Testes outbox/consumer com duplicação |
| Compatibilidade | Contratos públicos e migrations preservam consumidores | Testes de contrato + suites afetadas |
| UX | Formulários, acessibilidade, teclado, mobile e estados explícitos | Browser E2E autenticado e revisão |
| Recuperação | Backup preventivo antes de mutação de dados; restore completo no gate final MVP | Evidência de procedimento, sem alegar DR pronto |

Não atribuir metas numéricas de latência, uptime ou volumes que não tenham sido aprovadas; tratá-las como decisões pendentes.

---

## 9. Dependências e contratos opcionais

| ID | Dependência | Natureza | Efeito se não disponível |
|---|---|---|---|
| A08 | CoreKernel ports, tenancy e authorization | Obrigatória no Host | Nega execução protegida |
| A04 | Host NestJS, loader, guard e provider DB | Obrigatória para HTTP operacional | Serviço não sobe/indisponível |
| C01 / C02 | Catálogo/instalação ENABLED | Obrigatória para ativação controlada | Sem acesso operacional |
| C03/C04/C05 | Identidade, FGA, segredos | Obrigatória para produção | Fail closed |
| I04 | Banco do tenant | Obrigatória para persistência | Indisponível/sem DML |
| P02/P03/C06 | Observação WA/Inbox e resolução de identidade | Opcional para CRM básico | CRM básico permanece funcional |
| P04 | Contextos organization/workspace e workforce | Opcional para funcionalidades dependentes; gates atuais respeitados | Não habilitar multi-org sem SQL002 e grants |
| A01/A07 | UI Workspace e componentes compartilhados | Obrigatória para aceite da experiência | Backend pode existir sem UX homologada |
| Q03/Q05/Q07 | Testes de integração, segurança e CI | Gate de aceite | Não declarar entrega pronta |

**Atenção:** o campo "opcional" é relativo a uma **capability**, não altera silenciosamente as `dependencies` obrigatórias de `ModuleDefinition`.

---

## 10. Metas e WBS por entregáveis

| Meta | Resultado demonstrável | Gate |
|---|---|---|
| P01-M01 | Cadastros básicos, relações, tags, notas e auditoria com tenant isolado | Testes domínio/SQL/HTTP |
| P01-M02 | Identidades de canal, perfis associados e CSV seguros | Testes de compatibilidade e dados |
| P01-M03 | Integração WhatsApp/Inbox e contextos opcionais sem perda de dados CRM | Event contracts e testes A/B |
| P01-M04 | Jornada completa no Workspace com papéis reais | Browser E2E Keycloak/FGA |
| P01-M05 | CRM demonstrável e operacional sob gates do tenant | Preflight, deploy autorizado, observabilidade e aceite |

| WBS | Entregável | Metas associadas | Aceite |
|---|---|---|---|
| P01.01 | Domínio e persistência CRM canônicos | M01 | Suite PostgreSQL, isolamentos, auditoria |
| P01.02 | APIs de cadastro, relacionamentos, busca, CSV e capabilities | M01/M02 | Contratos HTTP + testes negativos |
| P01.03 | Reconciliação segura de identidade de canais | M02/M03 | Evento resolvido/revisão, replay e não sobrescrita |
| P01.04 | Experiência CRM no Workspace | M04 | Fluxos reais, acessibilidade e autorização |
| P01.05 | Homologação integrada e Product Gate CRM | M05 | E2E multiusuário/tenant, smoke e decisão de aceite |

**O WBS representa entregáveis, não tarefas em andamento.** Os resultados comprovados de cada bloco, pendências e sprint pertencem a `STATUS.md`.

---

## 11. Riscos, lacunas e decisões que exigem debate

| ID | Questão | Impacto | Tratamento sugerido |
|---|---|---|---|
| R01 | `Organization` CRM confundida com Platform Organization | Vazamento ou acesso cruzado | Documentar IDs e mappings e testar |
| R02 | EmployeeProfile confundido com login/workforce | Conta/privilégio indevido | Manter contratos separados |
| R03 | Nomes externos sobrescrevem cadastro confirmado | Corrupção de dados mestres | Testar reconciliação sem overwrite |
| R04 | Frontend mockado tomado como operacional | Produto entregue sem permissão real | E2E com Keycloak/FGA/tenant reais |
| R05 | `crm.person.review_required.v1` sem tratativa operacional | Pendência invisível | Definir fluxo/consumidor antes da ativação |
| R06 | Multi-org liberado antes do gate SQL002 | Quebra de escopo de dados | Manter bloqueio e testes |
| R07 | Redução de capabilities e endpoints em paralelo com consumidores | Regressão silenciosa | Expand–migrate–contract + contract tests |

### Decisões pendentes para aprovação

1. Definir nomenclatura canônica no produto para diferenciar organização CRM e Platform Organization.
2. Definir critérios mínimos da tratativa de ambiguidades de identidade WhatsApp; sem inventar tela antes do PRD.
3. Definir quais capacidades de EmployeeProfile serão expostas no MVP de Workspace sem duplicar Workforce.
4. Aprovar este escopo e suas metas como baseline do P01 após revisão impressa.

---

## 12. Aceite final e controle de mudança

Um agente **não pode** declarar P01 concluído por builds verdes, suíte sintética ou existência de arquivo. A conclusão exige confirmação por SHA de `main`, testes adequados, gates de tenant, demonstração com credenciais reais autorizadas, ausência de regressões, evidências documentadas e aprovação da experiência.

Mudanças propostas devem indicar requisito/CAP/WBS afetado, consumidores, compatibilidade, testes necessários e necessidade de aprovação. Não reescrever histórico em `STATUS.md`. Não remover contratos ou dados por simples "enxugamento de capability".

### Checklist de aprovação impressa

- [ ] Missão e fronteiras do CRM refletem o produto desejado
- [ ] Todos os casos de uso aprovados estão representados
- [ ] Capabilities essenciais e opcionais estão bem classificadas
- [ ] Contratos oferecidos/consumidos e ownership não se confundem
- [ ] Telas e funcionalidades de Workspace não foram inventadas
- [ ] WBS cobre os entregáveis acordados sem incluir pós-MVP
- [ ] Riscos e critérios de aceite são suficientes
- [ ] Aprovo este documento como escopo-base do P01

**Assinatura/decisão:** ______________________  **Data:** __________  **Revisão:** __________

---

## Referências técnicas do repositório

- `modules/core-crm/AGENTS.md`
- `modules/core-crm/src/contracts.ts`, `plugin.ts`, `service.ts`, `crm.controller.ts`, `postgres.ts`, `whatsapp-identity-events.ts`
- `modules/core-crm/sql/001_crm_foundation.sql` a `003_crm_employees_channels.sql`
- `modules/core-crm/test/` e `apps/core-host/test/crm*.mjs`
- `apps/workspace-web/src/features/crm.tsx`, `crm-person-detail.tsx`
- `docs/product/CORE-CRM-MVP-ACCEPTANCE.md`
- `docs/product/CORE-CRM-FRONTEND-COMPLETION.md`
- `docs/engineering/WBS-WA-DATA-CRM-WA-20261111.md`
