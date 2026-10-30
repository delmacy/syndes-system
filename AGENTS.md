# AGENTS.md — Syndes Global (unchanged)

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

A fase corrente é **WhatsApp (PRD-003)**; o Product Gate do Core CRM foi aceito em CRM-11 e o Inbox permanece operacional no escopo Tailscale.

## Princípios de engenharia
- Preferir monólito modular enquanto não houver evidência concreta para separação.
- Não criar abstrações para problemas hipotéticos.
- Infraestrutura acompanha a necessidade do produto, não o contrário.
- `IMPLEMENTED != INTEGRATED != TESTED != PROVEN != DONE`. Um módulo só está DONE se estiver integrado, seguro, testado, observável, utilizável e demonstrável.
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

## Orquestração e continuidade

- O coordenador deve manter a sessão de orquestração ativa enquanto houver workers trabalhando no módulo corrente.
- Observar periodicamente os workers e a Run, executar `orca orchestration check`, ler e tratar cada entrega, reconhecer deliveries pendentes e despachar o próximo follow-up quando houver trabalho autorizado.
- A entrega do Orca é pull-based: quando não houver nova mensagem, manter um ciclo de `check --wait`/checagem periódica; não presumir que o Orca abrirá uma nova interação automaticamente ao terminar um worker.
- Para planejamento, decomposição, checkpoints e fechamento de tasks, usar `.agents/skills/task-manager/SKILL.md` junto com a skill de domínio aplicável.
- Não encerrar o trabalho apenas porque um worker ficou idle, entregou um relatório, atingiu cota, perdeu liveness ou teve um dispatch encerrado; recuperar, substituir ou registrar o bloqueio e continuar pelo caminho seguro disponível.
- Workers não concedem aceite. O coordenador deve revisar evidências, atualizar o estado das tasks e continuar até o Product Gate do módulo ser `ACEITO`, ou até existir bloqueio externo explícito, documentado e sem alternativa segura.
- Não fazer commit, push, deploy ou avanço de módulo para mascarar uma lacuna de evidência; cada parada deve ter motivo, responsável e próximo passo registrados.

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

## Definição de Done global
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
