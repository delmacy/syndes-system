# Inbox — evolução da experiência de atendimento (Workspace)

**Data:** 2026-11-01
**Estado:** implementação incremental em desenvolvimento, **não concluída**.
**Dependência:** branch `feat/workspace-shell-v1`, PR #9 ainda em draft, que por sua vez depende da fundação Core Host/Inbox.

## Decisão de priorização

O responsável pelo produto informou expressamente que o **Core CRM continua incompleto**, especialmente no frontend, mas orientou avançar para a **Inbox (PRD-002)**. Isso é uma mudança de prioridade, **não um aceite do CRM**. As duas frentes precisarão passar por Product Gate antes do lançamento.

## Entrega desta iteração — frontend

Local: `apps/workspace-web/src/features/inbox.tsx`, sem adicionar containers nem alterar o Core Host.

- Fila de conversas com busca, filtros Todas/Abertas/Pendentes/Resolvidas, indicadores de atribuição/handoff e datas.
- Detalhe/histórico com mensagens de cliente, resposta da equipe e nota interna, cada tipo visualmente distinto.
- Estados Aberta, Pendente, Resolvida e controle de reabertura.
- Ações de **Assumir**, **Liberar** e **Transferir ao humano/bot**, reutilizando as rotas já existentes no backend.
- Compositor em três modos: resposta, nota privada da equipe, e entrada simulada. O canal de simulação não envia WhatsApp.
- Mensagens e notas bloqueadas na interface quando conversa resolvida, bot ativo ou atendente atual não é o responsável. O backend continua revalidando permissão e regras de domínio; UI **não é fronteira de segurança**.
- Sincronização periódica via HTTP a cada 10 segundos somente com aba visível; atualização de detalhes após comandos sem esperar o próximo polling. **Não é realtime push/WebSocket.**
- UX adaptada ao celular, alternando lista e detalhe com botão Voltar; sem scroll horizontal no smoke.
- Cliente HTTP ampliado para detalhes e handoff por URL escopada a tenant verificado pelo Core Host.

## Evidências e limitações dos testes

- `npm run build`: compilação TypeScript/Vite aprovada.
- `npm test`: 11 testes unitários aprovados, incluindo regras de bloqueio da resposta, rotas tenant-scoped, 401/403 e PKCE.
- `npm run test:inbox-ui`: fluxo de Chrome/Playwright com **API e identidade simuladas**, testando seleção, assumir/liberar, status, handoff, nota interna, entrada simulada, criar conversa e layout mobile. Não usa senha nem grava dados de cliente.
- O smoke com **Keycloak, OpenFGA e PostgreSQL reais para a UI atualizada** não foi concluído nesta iteração: o acesso à senha do usuário de teste foi bloqueado pelo executor remoto. Validações anteriores do Core Host via OIDC continuam válidas para a fundação, **não bastam para certificar as novas ações da Inbox**.
- Esta mudança altera somente a aplicação de tenant Workspace; APIs e schemas do backend permanecem inalterados.

## Pendente para o Product Gate da Inbox

1. Provar com **Keycloak real e permissões mínimas OpenFGA** as jornadas de atendentes, concorrência e isolamento entre tenants. Negação deve ocorrer antes de resolver a conexão do banco.
2. Implementar realtime push (WebSocket ou SSE) com autorização, renovação/expiração, escopo de tenant, reconnect, múltiplos atendentes e testes de isolamento. O polling atual é provisório e não atende `realtime` do escopo final.
3. Implementar anexos com limites, MIME validation, varredura de conteúdo, armazenamento segregado por tenant, quotas, autorização de download e auditoria.
4. Melhorar lista de atendentes, regras de atribuição, visualização de clientes CRM, permissões por ação e acessibilidade.
5. Testar paginação de conversas/mensagens; API atual lista no máximo 100 por consulta.
6. Completar testes reais de carga, falhas, backup/restore, políticas de produção e observabilidade.
7. Não declarar CRM ou Inbox concluídos antes do Product Gate formal, mesmo com CI verde.

## Como continuar

Leia `AGENTS.md`, `modules/inbox/AGENTS.md`, `docs/product/PRD-002-INBOX-ACCEPTANCE.md`, `docs/engineering/WORKSPACE-SHELL-ARCHITECTURE.md` e este checkpoint. Continuar em **um módulo funcional por vez**: Inbox. Não reabrir stacks Komodo, Admin Master, Customer Portal ou WhatsApp até a fase adequada.

A interface do Workspace em desenvolvimento é servida dos artefatos Vite compilados em `/srv/syndes-lab/system/apps/workspace-web/dist`, montados como read-only no Nginx estático. O arquivo público de runtime é montado **separadamente** do dist. Antes de publicação para clientes reais, substituir esse mecanismo por release imutável e testes integrados de autenticação/autorização.

**Documentação operacional:** `docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md`.
