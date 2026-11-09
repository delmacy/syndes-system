# PRD-002 — Core Inbox Development Acceptance

**Status (2026-11-01):** Em desenvolvimento; frontend atualizado no Workspace. **Não concluído e não autorizado para produção.**

## Approved journey

1. Authenticate through Keycloak with PKCE and authorize a canonical tenant.
2. Create a simulated conversation, optionally linking an existing CRM person in the **same** tenant.
3. Receive an inbound simulator message with a stable external message ID.
4. View chronological history and queue; assign conversation to an attendant.
5. Reply as assigned attendant; record a private internal note.
6. Transition open → pending → resolved; new inbound message reopens the thread.
7. Transfer assignment or change human/bot handoff; inspect basic metrics.
8. Verify tenant B cannot resolve, read or mutate tenant A's identifiers, and policy denial occurs before database resolution.

## Product Gate

- [x] Domain contract and PostgreSQL persistence belong to Inbox package.
- [x] Descriptor via `defineSyndesModule` with CRM dependency, migrations, permissions and assets.
- [x] Authenticated HTTP controller and responsive browser UI implemented.
- [x] Simulator supports idempotent inbound messages, no direct WhatsApp dependency.
- [x] Automated unit and disposable PostgreSQL integration tests committed.
- [ ] GitHub Actions green **on this PR head** (verify runs).
- [ ] Browser acceptance with real Keycloak client and tenant grants.
- [ ] Push realtime/attachments if required under the local Inbox AGENTS.md for full MVP gate.
- [ ] Operational secrets/recovery/hardening and production rollout (homologation).

No checklist is a substitute for reviewed CI evidence. Do not merge any chained PR automatically.


## Progresso do frontend no Workspace (2026-11-01)

- [x] Fila, busca, filtros aberto/pendente/resolvido e leitura da conversa com histórico.
- [x] Atribuição ao próprio atendente e liberação; transições de status e transferência humano/bot pela API.
- [x] Modos de composição separados: resposta, nota interna e entrada **simulada** (não canal externo).
- [x] Compositor respeita status, handoff e atribuição. Essa checagem é **somente UX**; OpenFGA e regras de escrita continuam no backend.
- [x] Atualização **periódica HTTP a cada 10 segundos** com aba visível; **não é WebSocket/realtime push**.
- [x] UI mobile lista/detalhe e navegação de retorno; teste de ausência de scroll horizontal.
- [x] 11 testes unitários de Workspace e smoke Playwright com APIs e identidade **simuladas**, sem gravação em tenant real.
- [ ] Homologar fluxo no navegador com Keycloak, tenant e OpenFGA reais.
- [ ] Realtime push autenticado com isolamento/reconexão.
- [ ] Upload, download, validação e retenção segura de anexos por tenant.
- [ ] UX e autorização granular para múltiplos atendentes; acessibilidade.
- [ ] Performance, recovery, observabilidade, backup/restore e Product Gate final.

Não confundir testes mockados de UI com aceite de segurança real. O backend atual não foi alterado.

## Melhorias da experiência de atendimento (2026-11-01)

- [x] Filtragem por responsabilidade ``Minhas / Não atribuídas / Todas`` através de parâmetro opcional na API, assignee obtido da identidade já validada pelo Core Host e cláusula SQL tenant-scoped antes do limite.
- [x] Contexto CRM no Workspace com dados mínimos de pessoa, notas e timeline, respeitando negações separadas do backend.
- [x] Layout desktop de três painéis e painel lateral mobile, testados no Chrome com dados mockados.
- [ ] Testes de aceite positivo/negativo do filtro por responsável com Keycloak real, múltiplos atendentes e FGA.
- [ ] Organizações/tags no contexto somente quando existirem endpoints autorizados aprovados para elas.

## Ficha CRM e experiência de composição (2026-11-01)

- [x] Exibir organizações e tags da pessoa por endpoints de leitura individualmente autorizados no CRM e com filtro de tenant no repositório.
- [x] Rascunhos apenas em memória, separados por conversa e tipo de mensagem, sem armazenamento no navegador.
- [x] Atalho Ctrl/Cmd+Enter para enviar; texto preservado após erro e limpeza só após sucesso (smoke Chrome com mock).
- [x] Consultas testadas em PostgreSQL temporário; acesso de tenant diferente não retorna vínculos.
- [ ] Teste com identidades Keycloak, OpenFGA e dados reais em diferentes perfis, e auditoria de UX.
- [ ] Fechar critérios de produto do CRM e Inbox antes do lançamento. Não marcar como entregue para produção.
