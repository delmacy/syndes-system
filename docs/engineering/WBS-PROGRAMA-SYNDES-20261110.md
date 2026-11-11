# WBS / EAP mestre — Syndes System

**Baseline:** 2026-11-10, atualizado em 2026-11-11 com a decisão PRD-003A (America/Sao_Paulo). **Repositório:** `delmacy/syndes-system`. **Escopo:** pendências identificáveis do MVP vigente, do Platform Manager, do Syndes Operations/Support, do isolamento organizacional, do fluxo de release e do backlog já aprovado para planejamento. **Não é uma autorização para deploy ou retirada da trava SQL 002.**

## Como ler e atualizar

- **P0:** risco técnico/segurança ou pré-requisito imediato de integração; **P1:** colocar produtos já implementados em operação; **P2:** Product Gate ou incremento comercial seguinte; **P3:** congelado.
- **PEND:** não concluído em produção; **BLOQ:** gate/dependência ainda não satisfeito; **CONGELADO:** escopo explicitamente pós-MVP. Itens com código/testes verdes permanecem pendentes de integração/homologação operacional.
- Cada tarefa exige um artefato, teste ou evidência rastreável e decisão explícita; `[ ]` vira `[x]` apenas com link para commit/CI, teste/smoke, ambiente e aprovação quando aplicável. Não usar "PR fechada" como evidência de integração.
- **Responsáveis** são papéis funcionais sugeridos, não pessoas designadas. Prioridades são de sequência, não cronograma. Nenhuma estimativa de horas ou promessa de data foi inventada.
- **Fronteira:** código em `main` ≠ migrado/deployado ≠ homologado; `front-shared` é package de build e não une sessões/segredos dos frontends.

## Estado de fato verificado em 10/11/2026

| Área | Evidência | Consequência |
|---|---|---|
| `main` atual | commit `8cf85e0` em GitHub; integração funcional #47 e CI #35/#53, além de Account Access #54 | Código-base presente, mas DevServer01 não está automaticamente no mesmo SHA |
| PRs abertas | [#56](https://github.com/delmacy/syndes-system/pull/56) workforce; [#57](https://github.com/delmacy/syndes-system/pull/57) preview; [#58](https://github.com/delmacy/syndes-system/pull/58) front-shared; [#59](https://github.com/delmacy/syndes-system/pull/59) UI modularizada | Integrar **deltas reais** na main atual, não fazer merge cego de branches antigas |
| PRs históricas | #33/#34 e #51 fechadas **sem merge próprio**, mas funcionalidades relacionadas entraram em `main` por #47/#54 | Verificar paridade funcional e evitar código duplicado |
| Divergência PR #59 | `main` com 52 commits exclusivos; branch #59 com 5 commits exclusivos no comparativo observado | Exige replay/rebase controlado e CI no HEAD integrado |
| Deploy da prévia | Tailnet HTTPS `:9446`, `syndes-platform-manager-visual` saudável, `GET /`=200; `/v1/platform/admin/me`=503 | Frontend visual com fixtures, **não** Manager real autenticado |
| Serviço em operação | Core Host, Keycloak, PostgreSQL ativos; WhatsApp gateway com imagem de escopo organizacional | Auditar versões/flags e não inferir homologação de produção |
| Gates abertos | Issues [#22](https://github.com/delmacy/syndes-system/issues/22), [#31](https://github.com/delmacy/syndes-system/issues/31), [#32](https://github.com/delmacy/syndes-system/issues/32), [#37](https://github.com/delmacy/syndes-system/issues/37), [#38](https://github.com/delmacy/syndes-system/issues/38), [#39](https://github.com/delmacy/syndes-system/issues/39), [#49](https://github.com/delmacy/syndes-system/issues/49) | Não marcar release sem checklist operacional e aceite |
| MVP planejado | `docs/product/MVP-SCOPE.md` e `MODULE-ORDER.md` | Core CRM → Inbox → WhatsApp → Scheduling → AI 1º nível → Documents → Email → Onboarding → Billing → Commercial Site |
| Service Management | `docs/engineering/WBS-SERVICE-MANAGEMENT.md` F0–F8 | Requer Product Gate próprio; não confundir com Support MVP |

**Decisão de escopo importante:** o Support MVP do tenant interno Syndes pode operar com **uma organização e SQL 002 ativo**; ativar múltiplas organizações (#31) não é pré-requisito obrigatório para o Support mínimo. Por outro lado, qualquer rollout multi-org depende da sua própria aprovação e backup/rollback.

## Caminho crítico recomendado

```text
00 Baseline/integração + 10 identidade/infra
            ├── 20 Manager real + operador global validado
            ├── 30 acesso da conta + workforce → telas Workspace
            └── 40 tenant Syndes → canal WA próprio → Support → gate #39
50 CRM/Inbox/WhatsApp real → 55 Gestão de Atendimentos Basic → 70 demais módulos MVP → 95 release comercial
                       ├── 60 Multi-org (gate #31, independente)
                       ├── 80 Funis (Product Gate separado)
                       └── 90 métricas sanitizadas (somente após Support + Manager)
```

**Trava de execução:** nenhum passo substitui testes negativos de autorização, ensaio de restore, evidência do SHA/digest real e aprovação de Product Gate. Alterações estruturais em GitHub Actions continuam na **frente paralela explicitamente delegada**. Manter `main` sem proteção administrativa por instrução vigente do proprietário; isso não elimina controles de qualidade e rastreabilidade.

## WBS detalhado — pacotes de trabalho pendentes

### WBS 00 — Baseline, governança e reconciliação de branches

**Prioridade:** P0 · **Responsável funcional:** Tech Lead + responsável pela integração · **Gate:** G0 — mainline coerente

| ID | Tarefa / entregável verificável | Critério objetivo de aceite | Depende | Estado |
|---|---|---|---|---|
| **00.01** | Congelar inventário rastreável de `main`, deploy e PRs #56–#59 | Comparativo por SHA, branch, checklist de arquivos e CI publicado; baseline `main` em 10/11: `8cf85e0` | — | PEND |
| **00.02** | Reconciliar PRs #33/#34/#51 encerradas e commits integrados por #47/#54 | Matriz arquivo/commit/teste, anotando funcionalidades incorporadas, ausentes e duplicadas sem reabrir PRs obsoletas | 00.01 | PEND |
| **00.03** | Inspecionar diferenças reais dos PRs #57 → #58 → #59 contra `main` | Plano de cherry-pick/replay/rebase pequeno e revisável, sem remover a CI central nem voltar a código antigo | 00.01–00.02 | PEND |
| **00.04** | Integrar `front-shared` e modularização na linha corrente | Um package canônico e dois builds independentes; desktop/mobile e zero duplicação; integração por PR com CI do SHA exato | 00.03 | PEND |
| **00.05** | Reconciliar PR #56 (DC-2c) contra `main` e pré-requisitos SQL | Preservar funções/constraints e flags atuais; sem ativar migração 007 nem retirar índices SQL 002 | 00.02 | PEND |
| **00.06** | Triar branches históricas, incluindo #1/#2/#3/#7/#50, sem apagá-las sem evidência | Tabela de commits exclusivos, decisão integrar/arquivar e ausência de regressões com links | 00.01 | PEND |
| **00.07** | Registrar matriz de CI central por impacto, incluindo `front-shared` e Workforce | Frente responsável por Actions confirma gatilhos, builds e testes; este WBS não altera workflows | 00.03–00.05 | PEND (outra frente) |
| **00.08** | Revalidar release candidate integrado após reconciliação | Builds reproduzíveis, 0 regressões, testes de isolamento/negativos e histórico do SHA correto | 00.04–00.07 | BLOQ |
| **00.09** | Conferir regras de governança da `main` e critérios de promoção | Manter `main` sem proteção administrativa conforme decisão do proprietário; CI e releases seguem rastreáveis | 00.01 | PEND |

### WBS 10 — Segurança transversal, infraestrutura e ambientes

**Prioridade:** P0 · **Responsável funcional:** Segurança + Infra/DevOps · **Gate:** G1 — identidade e isolamento

| ID | Tarefa / entregável verificável | Critério objetivo de aceite | Depende | Estado |
|---|---|---|---|---|
| **10.01** | Inventariar ambientes, URLs e mapa de rede real dos planos Control/Tenant | Diagramar Tailnet/Traefik/Keycloak/OpenFGA/PostgreSQL, imagens por SHA/digest e hosts; sem expor segredos | 00.01 | PEND |
| **10.02** | Revisar roles PostgreSQL e grants por banco/tenant | CONNECT negado para roles indevidas, menor privilégio, APIs com logins distintos e teste A/B | 10.01 | PEND |
| **10.03** | Auditar Keycloak OIDC e audiences por aplicação | Clientes e redirects exatos; issuer/aud/azp/sub; JWT Master recusado por Workspace/Support e inversamente | 10.01 | PEND |
| **10.04** | Validar políticas OpenFGA e memberships por tenant/org/workspace/recurso | Negativas 401/403 e deny em falha FGA, sem herança de Platform Owner ou Account Owner | 10.02–10.03 | PEND |
| **10.05** | Consolidar OpenBao e segredos runtime | AppRoles, distribuição por arquivo/UID, rotação/revogação, sem passwords em Git, logs ou artefatos | 10.01 | PEND |
| **10.06** | Definir observabilidade mínima, gestão de logs e PII | Métricas health/errors/latência sem PII, rotação/retention, limite de disco e alerta sem logs verbosos | 10.01 | PEND |
| **10.07** | Plano de backup/restore de Control DB e tenants | Backup criptografado fora do Git, restore em DB segregado com RPO/RTO medidos e procedimento de rollback | 10.02 | BLOQ (operação) |
| **10.08** | Segurança de sessão e acesso privilegiado | MFA/step-up, duração curta, revogação/logout federado conforme risco; não armazenar token em URL | 10.03 | PEND |
| **10.09** | Testes contínuos de vazamento por API, arquivos, mídia e SSE | Matriz A/B, wrong azp/aud, viewer, funcionário revogado, identificadores forjados e tentativas cross-workspace | 10.02–10.04 | PEND |

### WBS 20 — Platform Manager real — Control Plane separado

**Prioridade:** P0 · **Responsável funcional:** Platform Backend + Segurança + Frontend · **Gate:** G2 — Manager autenticado

| ID | Tarefa / entregável verificável | Critério objetivo de aceite | Depende | Estado |
|---|---|---|---|---|
| **20.01** | Consolidar o frontend Manager sobre `front-shared` | Somente Visão geral e Clientes aprovados, sem dados fictícios em build operacional; UI responsiva com testes | 00.04 | BLOQ |
| **20.02** | Manter visual preview como demo isolada até substituir por release autorizado | Preview 9446 identificada, sem chamadas reais; rollback testado e rota separada da API | 20.01 | PEND |
| **20.03** | Provisionar cliente OIDC Master com PKCE S256 e audiência exclusiva | Redirect HTTPS exato, azp/iss/aud verificados em Keycloak real; sem direct grant produtivo | 10.03 | BLOQ (infra/segurança) |
| **20.04** | Provisão restrita de `syndes_master_api` + OpenBao AppRole | Role somente SELECT metadados no `syndes_control`; CONNECT negado a DB tenant; acesso de segredo validado | 10.02,10.05 | BLOQ (infra) |
| **20.05** | Confirmar primeiro `Platform Owner` sem inventar identidade | Sub imutável aprovado, bootstrap auditado, revogação e recuperação de conta testadas | 20.03–20.04 | BLOQ (aprovação do proprietário) |
| **20.06** | Implantar API Master isolada da rede de Core Host/tenants | Redes internas apropriadas, health/ready, HTTP 401/403/503, filtros e quotas, nenhum GET ao Tenant Plane | 20.04–20.05 | BLOQ |
| **20.07** | Conectar UI real a `/me`, `/summary`, `/tenants` e detalhes | Metadados reais apenas do Control DB, paginação/busca/erros/empty sem mock ou dados privados | 20.01,20.06 | BLOQ |
| **20.08** | Publicar Manager autenticado em origem HTTPS dedicada | URL/porta finais aprovados sem colisão com 9443/9444/9446; migração da prévia e rollback explícitos | 20.06–20.07 | BLOQ |
| **20.09** | Homologar fluxos reais de operador autorizado, negado e revogado | Browser/Keycloak/PostgreSQL real: owner/operator/viewer, 401/403, tokens cruzados, expiração, refresh/logout | 20.08 | BLOQ |
| **20.10** | Evolução administrativa pós-MVP somente por novo contrato | Provisionar/suspender tenant, operadores, billing e métricas não entram sem PRD/API/FGA/auditoria próprios | 20.09 | BLOQ (fora do MVP Manager) |

### WBS 30 — Conta, colaboradores, papéis e equipes — Operations

**Prioridade:** P1 · **Responsável funcional:** Backend/Identidade + Frontend Workspace · **Gate:** G3 — workforce auditável

| ID | Tarefa / entregável verificável | Critério objetivo de aceite | Depende | Estado |
|---|---|---|---|---|
| **30.01** | Aprovar ADR e matriz de Account Owner/Admin vs Org Admin vs Supervisor/Agent | Capacidades sem superusuário, sem acesso implícito cross-tenant e recuperação do último titular definida | 10.04 | PEND |
| **30.02** | Revisar paridade do Account Access na `main` após PR #54 (antiga #51) | Schemas/serviço/JWT/idempotência/auditoria/testes PG reais comparados ao contrato DC-2a/2b | 00.02 | PEND |
| **30.03** | Provisionar com segurança API de delegação Account Owner/Admin | Role SQL `syndes_account_api`, client/audience OIDC, FGA e ingress limitado; sem login padrão compartilhado | 30.01–30.02,10.05 | BLOQ |
| **30.04** | Concluir fluxo de conceder, transferir e revogar titularidade | Proteção último owner e membresia, idempotência/replay, autoatribuição negada, recuperação órfã auditada | 30.03 | BLOQ |
| **30.05** | Adaptar PR #56 (DC-2c) à `main` sem migração operacional automática | Schema staff 007 e source revisados/CI PG A/B; índices SQL 002 continuam presentes | 00.05,30.01 | BLOQ |
| **30.06** | Criar API HTTP autorizada de funcionários, equipes e papéis por workspace | JWT de funcionário, Org/Workspace membership + FGA, SQL atômico, auditoria, escopos e casos negativos | 30.05,10.04 | BLOQ |
| **30.07** | Vincular CRM Employee a `sub` Keycloak e convites com aceite explícito | Subject verificado, duplicidade/replay negados, desligamento/revogação instantânea, nenhuma equivalência employee UUID=sub | 30.06 | BLOQ |
| **30.08** | Implementar gestão de equipes e supervisores no Workspace | Listar/atribuir/revogar/filtrar com APIs reais; team não concede permissão por si; teste mobile e E2E | 30.06–30.07 | BLOQ |
| **30.09** | Rever permissões de recursos concretos e funções de fila | Supervisor não lê Inbox/CRM só por cargo; queue-specific FGA, viewer apenas leitura e prova A/B | 30.08 | BLOQ |
| **30.10** | Navegação entre Manager e Workspace em origens separadas | Mudança explícita de aplicação/contexto sem compartilhar bearer, URL com JWT ou iframe privilegiado | 20.09,30.08 | BLOQ |
| **30.11** | Homologar desligamento, troca de equipe e auditoria ponta a ponta | E2E user ativo/inativo, transferência, workspace X/Y, tentativas forjadas e restore | 30.09–30.10 | BLOQ |

### WBS 40 — Tenant operacional Syndes e Central Syndes Support

**Prioridade:** P1 · **Responsável funcional:** Produto + Infra + Support + Segurança · **Gate:** G4 — Support piloto interno/externo

| ID | Tarefa / entregável verificável | Critério objetivo de aceite | Depende | Estado |
|---|---|---|---|---|
| **40.01** | Aprovar tenant operacional exclusivo da fornecedora e políticas LGPD | Registro de owner, finalidade, retenção, contato/ticket e risco; não reutilizar tenant de cliente | 30.01,10.07 | BLOQ (produto) |
| **40.02** | Provisionar Syndes como tenant convencional, com DB dedicado | Fluxo normal de registry, membership, org/workspace default e FGA; **manter SQL 002**; não requer ativar multi-org | 40.01,10.02–10.05 | BLOQ |
| **40.03** | Reconciliar código Support já integrado na `main` com PR #34 | Contratos de cases, queues, notas, filtros, auditoria, testes e correções posteriores verificados no SHA corrente | 00.02,40.02 | PEND |
| **40.04** | Provisionar conta/número WhatsApp exclusivos do atendimento Syndes | Parelhar, validar titularidade e webhook/Whatsmeow, sem usar canal comercial de cliente | 40.02 | BLOQ (operação) |
| **40.05** | Homologar CRM/Inbox/Support para público externo no tenant Syndes | Prospect→conversa→caso→fila→atendente→nota privada→resolução/reabertura; sem cruzar tenant | 40.03–40.04 | BLOQ |
| **40.06** | Homologar suporte interno com client OIDC dedicado e filas privadas | TI/Infra, Produto, Operações, Administrativo; solicitante só próprios, agente só filas autorizadas | 40.02–40.03,10.03 | BLOQ |
| **40.07** | Configurar concessões FGA, memberships de fila e auditoria | 401/403 público/interno/token cruzado, privacidade de notas e anexos, export/SSE negativos | 40.05–40.06 | BLOQ |
| **40.08** | Executar migrations somente no tenant Syndes + backup/restore pré-release | Schema idempotente e índices SQL 002 intactos, imagem por digest, rollback e restore ensaiado | 40.02–40.07,10.07 | BLOQ |
| **40.09** | Homologar origem privada/HTTPS, rate limit, SSE e monitoramento | Smoke real com WhatsApp exclusivo, casos internos/externos, redaction sem PII e falha fechada | 40.08 | BLOQ |
| **40.10** | Aprovar e liberar Support MVP pelo gate #39 | Aceite formal produto+segurança+operação; SHA/digest, janela, incidentes, rollback e checklist assinada | 40.09 | BLOQ (aprovação) |
| **40.11** | Criar acesso temporário a dados de cliente apenas com consentimento explícito | Support Access Grant por ticket/finalidade/escopo/TTL/aprovação/log/revogação; nenhum acesso permanente por Platform Owner | 40.10,30.09 | BLOQ (novo gate) |

### WBS 50 — CRM, Inbox, WhatsApp e Workspace existentes — hardening de MVP

**Prioridade:** P1 · **Responsável funcional:** Workspace + Core Host + WhatsApp · **Gate:** G5 — fluxo Basic real

| ID | Tarefa / entregável verificável | Critério objetivo de aceite | Depende | Estado |
|---|---|---|---|---|
| **50.01** | Confirmar paridade de CRM/Inbox/WhatsApp entre `main` e DevServer01 | Versões, módulos e migrations/flags inventariados; ambiente operacional não recebe alterações por suposição | 00.01,10.01 | PEND |
| **50.02** | Homologar CRM end-to-end com tenant e organização default | Contatos/empresas/vínculos, notas e histórico; owner SQL correto, Viewer negado em write, dados legados intactos | 50.01 | BLOQ |
| **50.03** | Homologar Inbox: fila, responsável, histórico e respostas | Handoff, assign, status, notas internas, receipts, scroll, SSE e fallback; E2E com identidade real | 50.01 | BLOQ |
| **50.04** | Corrigir regressões de layout/contatos verificadas na Inbox | Números/grupos no menu compacto, voltar/pesquisa, identificação de contato, sem ocupar área de conversa ou duplicar barras | 50.03 | PEND (verificar repro) |
| **50.05** | Homologar WhatsApp gateway e Whatsmeow real | Pareamento QR por tenant, inbound/outbound, reconexão, sessões, anexos e grupos; uma conta Basic | 50.01,50.03 | BLOQ |
| **50.06** | Auditar controles de rate limit, integridade e quotas dos canais | Sem duplicar mensagens, sem vazamento cross-tenant e sem logs que esgotem disco; replay de webhook negado | 50.05,10.06 | BLOQ |
| **50.07** | Revalidar Workspace OIDC, troca de contexto e ações por capacidade | Sem reaproveitar token do Manager; menu não concede permissão; falhas Core Host/FGA negam acesso | 50.02–50.06 | BLOQ |
| **50.08** | Fechar aceite do fluxo Basic CRM + Inbox + WhatsApp | Um tenant com casos reais, restarts, testes de negação, backups/rollback e runbook rastreáveis | 50.07,10.07 | BLOQ |

### WBS 55 — Gestão de Atendimentos Básica (PRD-003A) — inserida no MVP em 11/11/2026

**Prioridade:** P1 · **Responsáveis funcionais:** Produto + Backend + Workspace + Segurança · **Gate G5A:** atendimento com etapas e protocolo; **não** construtor genérico de funis. Detalhamento em `WBS-GESTAO-ATENDIMENTOS-MVP-20261111.md`.

| ID | Entrega e aceite | Dependências | Estado |
|---|---|---|---|
| **55.01 / SM-01** | Aprovar recorte Basic e atualizar baseline, PRD, AGENTS e WBS; F0–F8 avançado permanece pós-MVP | Decisão 11/11 | Escopo reconciliado em branch; CI pendente |
| **55.02 / SM-02** | Funil com 2–8 etapas configuráveis, protocolo independente de conversa, vínculo Inbox opcional, atribuição a pessoa autorizada, mudança adjacente e encerramento com trilha SQL append-only; testes PG A/B | CRM, Inbox, Organizations e SQL002 | Implementado em branch; PG17 sintético 14/14; CI e runtime pendentes |
| **55.03 / SM-03** | Integração do novo módulo no Host/installer, entitlements ENABLED, APIs REST OIDC+FGA+membership e erros 401/403/409 | 55.02, 10.02–10.05, 50.08 | BLOQ |
| **55.04 / SM-04** | Atribuição a equipes Workforce reais, elegibilidade/transferência e auditoria de origem/destino no mesmo Workspace | 30.06–30.11, 55.03 | BLOQ |
| **55.05 / SM-05** | Inspector Inbox e lista/Kanban funcional com dados autorizados, frontend compartilhado apenas visual | 55.03–55.04 | BLOQ |
| **55.06 / SM-06** | Restore real/staging, smoke JWT/tenant A-B/Workspace, rollback, browser e Product Gate | 10.07, 55.05, 95.03 | BLOQ |

**Fronteiras:** suporte `modules/support` é específico da Syndes; CRM mantém pessoas, Inbox conversa, WhatsApp mensagens. O módulo Basic **não** introduz templates, designer, SLA avançado, BPMN ou motor de automação. Cada fase precisa de CI, migrations com rollback e Product Gate, sem instalar SQL em produção automaticamente.

### WBS 60 — Multi-organização, Unidades e Workspaces (gate separado)

**Prioridade:** P2 · **Responsável funcional:** Produto + Segurança + Organizations · **Gate:** G6 — ativação multi-org opcional

| ID | Tarefa / entregável verificável | Critério objetivo de aceite | Depende | Estado |
|---|---|---|---|---|
| **60.01** | Aprovar formalmente Product Gate de múltiplas organizações #31 | Política org/workspace/Unidade e proibição de contato compartilhado implicitamente registradas | 50.08,30.11 | BLOQ (decisão) |
| **60.02** | Auditar migrations Organization 001–006, CRM, Inbox e WhatsApp | Backfill default, owners não nulos, índices SQL 002, replay idempotente e preflight | 60.01 | BLOQ |
| **60.03** | Validar ativação MANUAL transacional do modo multi-org em PG descartável | Ambos índices SQL 002 somente removidos na mesma transação aprovada; rollback completo demonstrado | 60.02,10.07 | BLOQ |
| **60.04** | Implementar/validar CRUD protegido de organizações, unidades e workspaces #22 | Unidade ≠ Site CMS; associar N:N workspace-unidade e memberships, FGA por recurso | 60.03 | BLOQ |
| **60.05** | Criar seletor autorizado de Organização/Workspace no Workspace | Sem terceiro nível obrigatório; troca de org/WS não expõe dados legados nem invalida isolamento | 60.04 | BLOQ |
| **60.06** | Testar Org A/B e Workspace X/Y no mesmo tenant | CPF/canais/CSV, CRM, WhatsApp, Inbox, SSE, transferências e viewer negados fora de escopo | 60.04–60.05 | BLOQ |
| **60.07** | Decidir topologia de SSE antes de múltiplas réplicas | Singleton/sticky OU broker com testes de consistência; não prometer HA sem infraestrutura | 60.06 | BLOQ |
| **60.08** | Rollout gradual por tenant e rollback reversível | Janela, feature flag, shadow/backfill, backup real e pós-smoke; nenhum tenant comercial migrado sem gate | 60.07 | BLOQ |

### WBS 70 — Demais módulos previstos do MVP comercial (ordem PRD-004–010)

**Prioridade:** P2 · **Responsável funcional:** Produto + módulo responsável · **Gate:** G7 — escopo Basic completo

| ID | Tarefa / entregável verificável | Critério objetivo de aceite | Depende | Estado |
|---|---|---|---|---|
| **70.01** | Scheduling (PRD-004): PRD/PG, agenda, disponibilidade, timezone | API+UI em tenant, conflitos e permissões testados; integra CRM/Inbox sem expor outras organizações | 55.03/55.06 | PEND |
| **70.02** | AI First-Level Assistant (PRD-005) com base de conhecimento por tenant | Fontes aprovadas, consentimento, limites de custo, handoff humano, proteção prompt injection/PII e E2E | 70.01 | PEND |
| **70.03** | Documents (PRD-006): armazenamento, ACL e lifecycle de anexos | Upload/download seguro, quota, retenção, tenant/record ACL, malware/links assinados e restore | 70.02 | PEND |
| **70.04** | Email (PRD-007): uma caixa por Basic | Conectar conta, inbound/outbound, retries/dedup, sigilo e integração de histórico por tenant | 70.03 | PEND |
| **70.05** | Onboarding (PRD-008) e provisioning repetível | Inscrição/identidade, tenant DB, módulos/entitlements, convite, test tenant e reversão auditada | 70.04,10.07 | PEND |
| **70.06** | Subscription & Billing (PRD-009) | Plano Basic planejado, limites/quotas, eventos de cobrança, suspensão/reconciliação e cobrança real com segurança | 70.05 | PEND |
| **70.07** | Commercial Website (PRD-010) e demonstração autoexplicativa | Oferta clara, demo sem dados reais, captação de leads, conversão e vínculo com onboarding/Support | 70.06 | PEND |
| **70.08** | Homologar tenant demo e jornada de primeiro cliente pagante | Cadastro→login→WhatsApp/CRM/Inbox→protocolo/funil Basic→agenda/IA/docs/email→fatura/backup com evidência real | 70.01–70.07 | BLOQ |
| **70.09** | Product Gate por módulo, conforme `MODULE-ORDER.md` | Cada PRD passa negócios→UX/segurança→técnica→testes→release; nenhum placeholder dado como pronto | 70.01–70.08 | PEND |

### WBS 80 — Construtor avançado de Funis e Templates — pós-MVP congelado

**Prioridade:** P3 / congelado · **Responsável funcional:** Produto + Arquitetura · **Gate:** G8 — somente após PRD-003A Basic homologado e novo Product Gate

| ID | Tarefa / entregável verificável | Critério objetivo de aceite | Depende | Estado |
|---|---|---|---|---|
| **80.01** | Definir construtor avançado além do Basic e aprovar novo PRD/ADR/PG | PG-01..PG-05 resolvidos; reutilizar equipes Workforce, não recriar colaboradores | 30.11,50.08 | CONGELADO (produto) |
| **80.02** | F1: catálogo de grupos/equipes/funis por API montável | PK/FK por tenant, validação grafo, draft revision, publicação imutável, concorrência 409 e testes PG A/B | 80.01 | CONGELADO |
| **80.03** | F2: criador visual de funis | Somente após API validada; lista/edição/publicação/arquivamento, E2E, acessibilidade e autorização | 80.02 | CONGELADO |
| **80.04** | F3: catálogo de templates oficiais/privados | Instalar como draft independente, sem copiar usuários/credenciais/dados privados | 80.03 | CONGELADO |
| **80.05** | F4 avançado: protocolos versionados, subprotocolos e reabertura complexa | Políticas configuráveis além do protocolo Basic; não duplicar histórico/auditoria já do SM-02 | 80.02 | CONGELADO |
| **80.06** | F5 avançado: transferência cross-funnel/cross-Workspace e correlação de protocolos | Revalidar origem/destino, contexto, motivo e direitos sem expor dados | 80.05 | CONGELADO |
| **80.07** | F6–F7 avançado: painéis multi-funil configuráveis, supervisão e templates | Não duplicar Inspector/Lista/Kanban simples do Basic SM-05 | 80.05–80.06 | CONGELADO |
| **80.08** | F8: políticas avançadas de SLA, presença e capacidade (Scheduling Basic é PRD-004) | Sem SLA fictício ou roteamento por presença inexistente; contrato e E2E próprios | 80.07,70.01 | CONGELADO |

### WBS 90 — Métricas sanitizadas Support → Manager (issue #37)

**Prioridade:** P2 · **Responsável funcional:** Dados + Segurança + Platform · **Gate:** G9 — agregados sem PII

| ID | Tarefa / entregável verificável | Critério objetivo de aceite | Depende | Estado |
|---|---|---|---|---|
| **90.01** | Aprovar ADR de snapshots, fontes, frequência, TTL e LGPD | Contagens permitidas por audience/status; sem ids/nomes/mensagens/telefones/notas | 20.09,40.10 | BLOQ |
| **90.02** | Criar produtor de agregados com identidade serviço restrita | Snapshots idempotentes/auditados no Control DB, sem acesso direto Master à DB de Support | 90.01,10.02 | BLOQ |
| **90.03** | API de leitura de snapshots e estados stale/indisponível | Nunca inventar zeros/SLAs na ausência de atualização; SQL deny CONNECT tenant | 90.02 | BLOQ |
| **90.04** | Indicadores visuais somente após API real aprovada | Nenhuma transcrição, token cruzado ou Inbox embutida; E2E/rollback/PII negativas | 90.03 | BLOQ |

### WBS 95 — Release, qualidade, governança e evolução pós-MVP

**Prioridade:** P0→P3 · **Responsável funcional:** Produto + QA + Segurança + Operações · **Gate:** G10 — go-live comercial

| ID | Tarefa / entregável verificável | Critério objetivo de aceite | Depende | Estado |
|---|---|---|---|---|
| **95.01** | Estabelecer Definition of Done transversal e evidência por pacote | PRD, contratos, testes, migrações, segurança, UX, runbook, SHA/digest, rollback e Product Gate por item | 00.09 | PEND |
| **95.02** | Executar CI integrado por impacto com testes negativos preservados | Code + PG17 + Keycloak/OpenFGA + browser + Go/TS + Docker; sem diminuir cobertura | 00.07,95.01 | PEND (outra frente) |
| **95.03** | Criar staging imutável e promoção por digest | Sem banco produtivo involuntário, migrations aditivas controladas, smoke automatizado, pin e rollback | 10.01–10.07,95.02 | BLOQ |
| **95.04** | Validar privacidade, LGPD, retenção e acesso a dados reais | Política, consentimento, exclusão, auditoria, anexos, backups e incident response documentados | 10.06–10.07 | BLOQ |
| **95.05** | Ensaiar falhas e DR: Keycloak, FGA, OpenBao, DB, SSE, WhatsApp | Fail closed, degradar com segurança, recuperação documentada e disponibilidade observada | 95.03–95.04 | BLOQ |
| **95.06** | Homologação E2E de jornada comercial e isolamento | Cliente A/B, usuário revogado, pagamento, atendimento e restauração com evidências assinadas | 70.08,95.05 | BLOQ |
| **95.07** | Aprovação explícita da janela de produção e plano de rollback | Assinatura produto/engenharia/segurança/operação, checklist por digest, sem autorizar deploy por WBS | 95.06 | BLOQ |
| **95.08** | Operar piloto com ao menos um cliente externo pagante | Suporte, onboarding, billing, monitoramento, backup real e feedback; sucesso MVP definido em `MVP-SCOPE.md` | 95.07 | BLOQ |
| **95.09** | Pós-MVP congelado: Instagram, GCal, automações amplas, CRM avançado, OS, financeiro, estoque/ERP | Sem desenvolvimento sem novo Product Gate; inclui múltiplos WhatsApps, marketplace, native mobile, white-label, i18n, hyperscale | 95.08 | CONGELADO |

## Critérios transversais de pronto para cada item/PR

1. **Escopo:** requisito aprovado, WBS ID e limites do que não será feito.
2. **Código:** APIs/frontend reais, sem dados/menus inventados; pacote isolado por domínio e sem duplicação `front-shared`.
3. **Segurança:** menor privilégio, validação JWT + membership + OpenFGA/SQL, cross-tenant negativa, auditoria e sem secrets.
4. **Qualidade:** unit, PostgreSQL descartável, E2E/Playwright e regressões anteriores, sem `skip` para mascarar falha.
5. **Integração:** commits revisáveis, testes do SHA integrado, CI central validado; nenhum push/merge deve apagar funcionalidade da `main`.
6. **Ambiente:** build por SHA/digest, migrations/backup/restore/rollback, smoke real e observabilidade sem PII.
7. **Conclusão:** registrar resultado, responsável, evidência, decisão Product Gate e estado distinto `CODE / CI / STAGING / PROD`.

## Produto e decisões ainda exigindo autorização

- Primeiro `Platform Owner`: identidade Keycloak `sub` e grant aprovados; não inferir usuário a partir de senha/default.
- Tenant Syndes: definição de owner, aceite de retenção/privacidade, WhatsApp próprio e participação de filas.
- Multi-org: autorização formal do gate [#31](https://github.com/delmacy/syndes-system/issues/31); **não** remover SQL 002 por rotina automática.
- Funis: aprovar F0 antes de criar CRUD/editor; equipes devem reutilizar identidade já modelada em Workforce.
- Gestão de dados de cliente por Support: grant temporário de acesso com ticket/aprovação/TTL; nunca usar o papel Owner global como atalho.
- Pricing do Basic (R$ 69,90 nos meses 1 e 2, R$ 129,99 a partir do mês 3, até 3 usuários) é **planejado**, não preço implantado; validar com produto antes da cobrança.
- Pós-MVP congelado permanece sem execução até uma nova priorização explícita.

## Frente transversal vinculada — Account & Access / Kernel / schemas (10/11/2026)

A arquitetura de administração unificada de acesso, entitlements por tenant e schemas individuais por módulo foi desdobrada em [ADR-ACCOUNT-KERNEL-MODULE-SCHEMAS-20261110.md](ADR-ACCOUNT-KERNEL-MODULE-SCHEMAS-20261110.md) e [WBS-ACCOUNT-KERNEL-MODULE-SCHEMAS-20261110.md](WBS-ACCOUNT-KERNEL-MODULE-SCHEMAS-20261110.md). As tarefas AK-00..AK-60 detalham dependências das frentes 00, 10, 30, 50, 70 e 95 **sem substituí-las**. Nenhuma tarefa implica deploy, migração operacional, desativação de SQL 002, liberação de multi-org ou alteração de GitHub Actions. A conversão de fixtures sem clientes comerciais é permitida, mas ambientes runtime exigem inventário/backup e gate próprio.

## Referências versionadas

- [MVP Scope](../product/MVP-SCOPE.md), [Module Order](../product/MODULE-ORDER.md).
- [WBS Service Management](WBS-SERVICE-MANAGEMENT.md), [Product Gate](SERVICE-MANAGEMENT-PRODUCT-GATE-20261108.md).
- [Manager PRD/WBS](PLATFORM-MANAGER-PRD-WBS.md), [Manager Release](PLATFORM-MANAGER-RELEASE.md).
- [Support WBS](WBS-SYNDES-SUPPORT.md), [Support Release Gate](SYNDES-SUPPORT-RELEASE-GATE.md).
- [Account Access](ACCOUNT-ACCESS-FOUNDATION.md), [Mainline CI](MAINLINE-CI-POLICY.md).
- Issues [#22](https://github.com/delmacy/syndes-system/issues/22), [#31](https://github.com/delmacy/syndes-system/issues/31), [#32](https://github.com/delmacy/syndes-system/issues/32), [#37](https://github.com/delmacy/syndes-system/issues/37), [#38](https://github.com/delmacy/syndes-system/issues/38), [#39](https://github.com/delmacy/syndes-system/issues/39), [#49](https://github.com/delmacy/syndes-system/issues/49).


### AK-10.02 — Catálogo de módulos (candidato; não operacional)

- **Base:** PR #66 (Kernel 39b2654), ADR/WBS da PR #65 e [evidência do catálogo](AK-10-02-CONTROL-MODULE-CATALOG-20261110.md).
- **Estado:** implementação candidata SQL/ports/adapter e PG17 descartável; PEND integração, CI, catálogo aprovado e Control DB operacional. Não cria entitlement (AK-10.03), não liga executeModule ao Host (AK-10.04), não instala migrations (AK-30) e não ativa schema Organizations da PR #68.
- **Dependência crítica:** integrar PR #66, depois AK-10.03 → AK-10.04/AK-30 → AK-40.01.

### AK-10.03 — Entitlements e intenções de instalação por tenant

- **Base:** PRs #66 (Kernel), #69 (catálogo) e [documentação da lifecycle](AK-10-03-TENANT-MODULE-LIFECYCLE-20261110.md).
- **Estado:** candidato SQL/ports/read adapter + transições auditadas e PG17 descartável; **PEND** integração/main/CI/Account & Access API/ambiente operacional. Entitled/requested/suspended não equivale a installed/enabled; funções administrativas não promovem esses estados até AK-30.
- **Gate G1 aberto:** persistência com tenants A/B demonstrada em fixture; faltam AK-10.04 em rotas e workers, ledger SQL e identidades FGA/Keycloak reais. Nenhum bootstrap/deploy operacional foi alterado.

### AK-30.01/02 — Ledger e instalador versionado (candidato inativo)

- **Base:** PRs #66 → #69 → #70, com [evidência de instalador](AK-30-01-02-TENANT-INSTALLER-20261110.md).
- **Estado:** PLAN/APPLY/VERIFY com ledger SQL protegido _syndes, checksums, digest, transações, rollback em falhas e attestation idempotente no Control DB foram implementados para fixture PG17 em dois DBs tenant e um Control DB. **PEND** main/CI, scripts registrados, identidade técnica real, ACL mínima, política de upgrade, organização/CRM real e restore/rollback operacional.
- **Regra:** INSTALLED somente após VERIFY e atestação por operador técnico; ENABLED e controle efetivo de API/job continuam bloqueados pela AK-10.04. Nenhum banco operacional, UX, Actions ou SQL 002 alterados.
- **Próximo gate:** AK-10.04 + AK-30.03/04/05 e inventário/backup autorizados para qualquer migração persistente. A PR #68 de Organizations continua candidata e inativa.

### AK-20 — Consulta de módulos no Platform Manager (Control Plane read model)

- **Decisão:** [ADR da composição Control/Tenant](ADR-CONTROL-TENANT-MODULE-COMPOSITION-20261110.md). Reusar master-admin-api, master-admin-web, account-access-api e front-shared; não duplicar backend, frontend ou tokens.
- **Candidato:** endpoint GET /v1/platform/admin/tenants/:id/modules com autorização própria de operador e sem acesso a tenant DB; frontend no detalhe do cliente, sem operação mutável nem dados falsos em preview. Script control-module-manager-readonly.schema **não aplicado**. Testes A/B e ACL em PG17 descartável.
- **Bloqueio:** schemas AK-10.02/03 e role read-only de produção não ativadas; endpoint devolve 503 até migration autorizada. Não habilitar usuários, módulos, licenciamento ou dados operacionais pelo Manager.
- **Próximo:** AK-10.04 em handlers e workers, API de comando com identidade, RBAC, auditoria e instalador técnico isolado.

### AK-10.04 — Gate efetivo no Host (parcial)

- **Candidato implementado:** [contrato AK-10.04](AK-10-04-CONTROL-ENABLED-MODULE-GATE-20261110.md) / PgEffectiveModuleAccess conectado ao CoreKernel.moduleAccess. Concede somente entitled + enabled + release/build aprovada + metadados verificados + dependências todas habilitadas no mesmo tenant. Falha fechada em erro de catálogo ou Control DB.
- **Limite:** SOMENTE CoreKernel.executeModule, sem mudança dos controllers legados que ainda chamam execute nem jobs. Nenhum tenant é automaticamente habilitado. **Gate operacional ainda PEND** até AK-30 attestation/ENABLED com identidade, migração de rotas/workers e rollout seguro.
- **Evidência:** unit tests + PG17 descartável A/B/C/D e testes de version/expiry/dependency; CI do SHA integrado obrigatória.

### AK-30.03 — Comandos auditados de ENABLED/DISABLE (candidato inativo)

- **Implementado:** [contrato e testes](AK-30-03-MODULE-ACTIVATION-20261110.md), role exclusiva syndes_module_activator NOLOGIN e comandos Control SQL installation.enable/disable, com replay/concorrência, checks de entitlement, versão, receipt e dependências ENABLED. PgModuleInstaller verifica ledger físico antes de ENABLE. DISABLE preserva instalação verificada e funciona mesmo com tenant suspenso.
- **Correção de bug:** dependências INSTALLED **ou ENABLED** são elegíveis em APPLY/VERIFY/attestation: habilitar CRM não bloqueia a instalação posterior do Inbox.
- **Evidência:** testes em PG17 descartável de dois bancos tenant e Control DB, sem SQL operacional, incluindo replay antigo negado após nova transição e drift negado antes de reabilitação.
- **Ainda PEND:** CI SHA integrado, Control DB versioned migrations/backup, operador autenticado com role dedicada, reconciliador de ledger, upgrade/rollback, adaptação de todos os handlers/worker para executeModule, homologação em cluster real. Nem Manager nem Core Host recebem poder de ENABLE nesta fatia.

### AK-30.04 — Control DB versioned migrations (planejamento e ensaio)

- **Implementado:** [runner e gates](AK-30-04-CONTROL-DB-VERSIONED-MIGRATIONS-20261110.md), scripts/control/module_migrations.py com plano default somente SELECT, ordem fixa SHA-256, ledger versionado, transação atômica, retry NOOP, recusa de drift/fora de ordem/parcial, sem SQL de tenant. Testes unitários e PG17 descartável.
- **Evidência operacional somente leitura:** Control DB PG17, 1 tenant ativo, cinco migrations pendentes; archive_mode=off, restaurabilidade ainda sem prova. Comando de aplicação real bloqueado por ausência de evidências de backup/restore e Product Gate.
- **Próximo:** restore real autorizado, staging com Keycloak/OpenFGA/OpenBao, least-privilege operator, migração de todos handlers/jobs para executeModule, plano de rollback. **Sem deploy do catalog/activation nas bases reais nesta entrega.**

## Adendo — Composição frontend/backend e sequência de implementação (2026-11-10)

A arquitetura definitiva está em [ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md](ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md); a nova [WBS de composição](WBS-FRONTEND-BACKEND-COMPOSITION-20261110.md) detalha as etapas **FC-00 → FC-05** sem substituir os WBS 00/10/20/30/50/95. Dois frontends por audiência (Manager e tenant), não um frontend por módulo: features React dentro de apps/workspace-web, backend NestJS em modules/*, primitivos compartilhados via packages/front-shared.

**Ordem de trabalho:** inventário e contratos → shell/context selector/registry estático mantendo UI → gate backend em controllers/jobs e endpoint tenant-safe de módulos → Account e Organization com API real → homologação Manager/backup/restore/E2E. Account/Organization/Workspace são contextos; CRM/Inbox/WhatsApp são módulos. Organization da plataforma e Organization do CRM não são a mesma entidade.

**Estado:** documento consolidado e plano; não autorizam SQL operacional, liberação multi-org, remoção da trava SQL 002, novo produto ou deploy. Código de catálogo, activation e migration está integrado à main em PRs #72–#75, mas não foi executado no Control DB real, e o Manager segue com demo visual na :9446.
