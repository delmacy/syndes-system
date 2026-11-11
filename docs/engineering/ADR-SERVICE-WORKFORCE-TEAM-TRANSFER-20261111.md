# ADR — Gestão de Atendimentos: roteamento por equipes Workforce (SM-04)

**Data:** 2026-11-11 · **Estado:** implementado em código e testado com dados sintéticos; **não autorizado para deploy operacional**.

## Decisão

O módulo `service-management` referencia **as equipes canônicas** de `Organizations/Workforce` (migration manual 007), sem criar uma tabela de equipes, usuários ou grants próprios. A migração aditiva `modules/service-management/sql/002_service_team_transfer.sql` acrescenta ao protocolo um `team_id` opcional com FK composta `tenant, organization, team, workspace`. Uma transferência conserva o protocolo, a conversa Inbox e o funil, e altera apenas equipe, atribuição (sempre limpa), versão CAS e `updated_at`. A auditoria append-only registra equipe de origem/destino, ator e motivo no mesmo commit. Não há mudança automática na Inbox/CRM ou em mensagens do WhatsApp.

### Contrato de segurança

1. **Identidade do Host:** JWT verificado fora do pacote, principal OIDC tipo `user`. `Kernel.executeModule` exige membership tenant, Control `ENABLED`, dependencies atestadas e OpenFGA para `service:attendances` e `service:teams`.
2. **OpenFGA por equipe:** além de `service:teams/write`, cada transferência exige `service:team:<uuid>/write` da origem, quando existe, e do destino. Nenhuma presença em Workforce provisiona essas tuplas. Ausência ou indisponibilidade FGA nega por padrão.
3. **Escopo SQL:** Organization e Workspace selecionados e autorizados; mesma organização e workspace físico, SQL002 mantido. O autor precisa ter membership `admin` em ambos mais `platform_workspace_staff_roles=supervisor`, `platform_staff_identity_links=active` e funcionário CRM ativo e não arquivado. Uma designação de supervisor **não** é permissão FGA.
4. **Destino:** a equipe está `active`, ligada explicitamente ao Workspace via `platform_staff_team_workspaces` e possui pelo menos um membro `active` com identidade, designation `agent|supervisor`, CRM employee ativo, pessoa do mesmo escopo e memberships ativos. Não encaminhar para equipes arquivadas, vazias ou cujo último agente foi revogado.
5. **Concorrência:** preleitura da equipe sob tenant/escopo autorizado, avaliação FGA origem/destino, e update posterior com versão CAS e revalidação SQL em transação pinned. Se o estado mudar entre as etapas, update retorna conflito sem mutação ou evento. O motivo é obrigatório e vinculado ao evento por `SET LOCAL` na mesma transação. Ninguém fornece GUC diretamente pelo frontend.
6. **Visibilidade:** apenas supervisor Workforce ativo ou membro ativo/elegível da equipe corrente vê atendimento roteado na lista/board, GET e histórico. Revogar identidade, designação, membership, vínculo ou funcionário remove o acesso **imediatamente** na próxima consulta. A equipe anterior não conserva acesso após transferência. Atendimentos ainda sem equipe seguem a visibilidade original do Workspace; isso é uma decisão de MVP, não acesso por equipe.
7. **Modificações:** stage, assignment e close usam a mesma verificação de visibilidade da equipe corrente; assignee deve pertencer à equipe atual ou ser supervisor elegível. Trigger SQL reforça a regra mesmo se um consumidor tentar atualizar diretamente. Audits `team_transferred` são append-only.
8. **Fronteiras:** transferência apenas intra-Workspace, para supervisores; não cria/revoga grants, nem implementa balanceamento, auto-routing, SLA, cross-org, permissões por Inbox/WhatsApp, templates e suporte a múltiplos Workspaces além de SQL002.

### Release gates e dependências que permanecem

- **Ordem:** Organizations 001/002, CRM 001/003, Inbox/WhatsApp, Organizations 003, Workforce **007 manual** e Service Management 001; somente depois Service Management **002**, após backup/restore homologado e migration ledger aprovado. Testes PG17 descartáveis não substituem restore operacional.
- **Roles least privilege:** runtime não pode ser superuser/owner do database, não pode alterar os gatilhos de auditoria, e precisa de SELECT mínimo para as tabelas Workforce acima. Validar em staging real.
- **Installer/entitlements:** migration 002 está no descriptor do plugin e na imagem, mas o plugin segue ausente de `apps/core-host/config/modules.json`. `Control ENABLED`, FGA dinâmica de origem/destino e instâncias operacionais ainda não foram configurados.
- **Pré-requisito e rollback testados:** o fixture PG17 instala Service 001 antes de Workforce 007, tenta Service 002, exige erro SQLSTATE `55000` e comprova que `team_id` não foi criado pela transação recusada; só depois instala Workforce 007, aplica Service 002 e repete a migration sem corromper protocolos/auditoria.
- **CI:** não alterar workflow desta frente. Cobertura do módulo `service-management` no pipeline central permanece na Issue #94; a suíte PG17 local passou 18/18 com migração reaplicada.
- **Frontend:** nenhuma UI é liberada pela implementação; Inspector/Lista/Kanban somente após módulo habilitado, dados reais e autorização no Host. Não adicionar dados fictícios ou componentes duplicados.

**Evidência executável:** `bash scripts/service-management/run_disposable_pg17.sh --disposable --ack-synthetic`. O teste usa dois bancos de tenant isolados, migrações reais, equipe de origem, equipe de destino, equipe vazia, funcionários CRM/Workforce sintéticos, revogação, FGA simulada, rollback por transação, audit e limpeza automática.

### Adendo Inspector (2026-11-11)

A leitura por conversa da Inbox foi adicionada no módulo v0.3.0, com FGA dupla e filtro pela equipe atual. O Inspector não modifica ownership nem transfere a conversa. Ver `ADR-SERVICE-INBOX-INSPECTOR-READ-20261111.md`.

**SM-03C (11/11/2026):** módulo agora usa ID canônico `service`, pacote `@syndes/service` e schema próprio `service`; a URL pública `/service-management` não mudou. Testes de instalabilidade foram feitos apenas em PG17 sintético.
