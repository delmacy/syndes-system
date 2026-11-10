# AGENTS.md — Syndes Global

## Missão

Entregar o MVP da Syndes até produção e primeiro cliente externo pagante, sem reabrir continuamente o escopo.

## Regra principal

Antes de implementar qualquer ideia nova, classifique-a:

- `BLOCKER`: impede entrega, operação, segurança ou compliance.
- `BUG`: comportamento do escopo aprovado que está incorreto.
- `MVP`: explicitamente previsto no baseline.
- `POST-MVP`: todo o resto.

Itens `POST-MVP` podem ser registrados em uma linha, mas **não recebem pesquisa, arquitetura, spike, WP ou implementação antes do lançamento**.

## Ordem de execução

Trabalhar funcionalmente em apenas um módulo de produto por vez:

1. Core CRM
2. Inbox
3. WhatsApp
4. Scheduling
5. AI First-Level Assistant
6. Documents
7. Email
8. Onboarding
9. Subscription & Billing
10. Commercial Website
11. Release Candidate

**Priorização mais recente (2026-11-01):** após a evolução da Inbox, o responsável pelo produto **autorizou concluir as tarefas pendentes do frontend Core CRM**, mantendo o escopo do MVP congelado. O foco imediato é validar e finalizar `feat/crm-workspace-completion` e seus critérios, não abrir novos módulos. CRM e Inbox **não são DONE** até Product Gate formal com testes de identidade/tenant reais e operação comprovada. A sequência comercial do MVP permanece inalterada.

## Princípios de engenharia

- Preferir monólito modular enquanto não houver evidência concreta para separação.
- Não criar abstrações para problemas hipotéticos.
- Infraestrutura acompanha a necessidade do produto, não o contrário.
- `IMPLEMENTED != INTEGRATED != TESTED != PROVEN != DONE`.
- Um módulo só está DONE se estiver integrado, seguro, testado, observável, utilizável e demonstrável.
- Não duplicar source of truth.
- Não introduzir provider externo diretamente no domínio; usar contratos/adapters quando houver risco de substituição real já conhecido.
- Não criar framework genérico de plugins, workflow engine ou marketplace no MVP.

## Segurança global

Segurança é requisito funcional transversal.

Obrigatório:

- tenant isolation;
- server-side authorization;
- least privilege;
- validação de input;
- segregação de secrets;
- TLS;
- logs sem passwords/tokens/credenciais financeiras;
- auditoria de operações críticas;
- backups e restore testado;
- webhooks autenticados e idempotentes;
- uploads validados;
- ações de IA mediadas por tools autorizadas;
- nenhuma seleção de database/tenant controlada pelo cliente.

Uma única exposição cross-tenant é falha crítica.

## Dados

- Control Plane possui banco próprio.
- Cada tenant possui PostgreSQL database próprio.
- IDs permanentes não dependem de nome comercial.
- Platform admin não implica acesso automático ao conteúdo dos tenants.
- CRM é fonte canônica de pessoas/organizações; canais mantêm identidades externas vinculadas.

## Billing

Cada pagamento confirmado concede 30 dias de uso a partir da confirmação.

- D+0 a D+10: operação completa.
- D+11: AI N1 suspensa.
- D+31: gateway WhatsApp suspenso.
- Inadimplência não apaga dados nem destrói a sessão/configuração WhatsApp.
- Regularização reativa automaticamente e define novo `paid_until = payment_confirmed_at + 30 dias`.

## Git e CI

- Não considerar um commit saudável sem CI verde.
- Toda alteração deve preservar testes existentes.
- Não enfraquecer testes para fazer CI passar.
- Migrations devem ser testáveis em banco descartável.
- Dependências devem ser instaladas com lockfile congelado quando a stack for criada.
- Stress tests pesados não rodam em cada commit; integridade rápida roda em commits/PRs.
- Release Candidate exige stress, spike, soak, backup/restore e isolamento aprovados.

## Performance

Perfis de stress planejados:

- 50 tenants
- 200 tenants
- 500 tenants
- 1000 tenants
- 2500 tenants

O objetivo é descobrir gargalo, ruptura e recuperação sob RAM/CPU controladas.

Invariantes que não podem degradar:

- cross-tenant leak = 0
- unauthorized access = 0
- corrupted records = 0
- mensagens não podem desaparecer silenciosamente

## Antes de editar um módulo

Leia o `AGENTS.md` mais próximo do arquivo. Regras locais complementam este documento e não podem reduzir segurança ou ampliar escopo.

## Definition of Done global

Uma entrega só é DONE quando:

- requisitos aceitos;
- regras de negócio implementadas;
- persistência correta;
- frontend/backend integrados quando aplicável;
- autorização aplicada;
- isolamento testado;
- erros tratados;
- logs e métricas suficientes;
- testes automatizados relevantes verdes;
- segurança revisada;
- jornada de aceite demonstrável.

## Arquitetura aprovada: Account, módulos, schemas e medição (2026-11-10)

- Fonte das decisões: `docs/engineering/BILLING-METERING-FOUNDATION-20261110.md` e ADR/WBS de Account & Kernel da PR #65 (até integrar ao main); contrato inicial do Kernel na PR #66. WBS mestre permanece canônica.
- `packages/core-kernel` define contratos portáveis, nunca preço, PSP, desconto, invoice ou conta comercial. `apps/core-host` integra pacotes confiáveis, tenant, Keycloak, OpenFGA, OpenBao, PostgreSQL e guards. `apps/account-access-api` e Organizations são as bases da administração única de contas, memberships, grants e validade — não criar cadastro de identidade paralelo.
- Cada tenant mantém database próprio. Cada módulo possuirá schema curto exclusivo de domínio (`organizations`, `crm`, `inbox`, `whatsapp`, `support` etc.) após migração testada; Control Plane permanece em database separado. `_syndes` é reservado ao instalador/ledger; `read`/`reporting` a projeções somente com consumidores e dependências declaradas. Schema não substitui grants PostgreSQL nem OpenFGA.
- O catálogo do Control Plane decidirá `entitled`, `installed`, `enabled` e `suspended` por tenant; negar módulo sem habilitação inclusive em workers. Não executar migrations de todos os módulos indiscriminadamente; desativar não implica `DROP CASCADE`. SQL 002/multi-org permanecem sujeitos a Product Gate #31.
- Metering é medição técnica, com evento idempotente (`tenantId`, `meterId`, `sourceEventId`, `occurredAt`, `quantity`), sem precificação. Entitlements e quotas pertencem ao contrato/Control Plane. O módulo proprietário define a métrica e sua origem; não contar retry como consumo adicional.
- `Subscription & Billing` (módulo `billing`, PRD-009) será construído posteriormente como domínio próprio de planos, preços versionados, combos, promoções, faturamento, impostos, pagamentos, créditos e PSP. **Payments não é o nome do módulo**; não antecipar funcionalidades financeiras enquanto Kernel/CRM/Inbox/WhatsApp e seus gates estiverem pendentes. Não confundir com módulo futuro `finance` para ERP dos tenants.
- Neste ciclo, apenas contratos, quotas/entitlements e pontos de extensão justificados. Preservar a ordem MVP e as regras históricas de `paid_until`/inadimplência até uma revisão de produto explícita. Nenhum agente tem autorização implícita para alterar bancos operacionais ou realizar deploy por ler este documento.