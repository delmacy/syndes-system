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

## Incremento de UX: filas por responsável e contexto CRM (2026-11-01)

**Status:** implementado em branch de desenvolvimento, com aceitação de produção ainda pendente.

- Fila com seleção **Minhas / Não atribuídas / Todas** combinável com status. O filtro ``queue`` é aplicado **no backend PostgreSQL antes de LIMIT 100**, dentro do tenant ativo; ``mine`` usa ``ctx.actor.id`` verificado pelo Core Host, nunca um ID de atendente fornecido pelo browser.
- Painel contextual da pessoa vinculada à conversa. Apresenta nome, e-mail, telefone, últimas quatro notas e até cinco eventos do histórico, consultados nas rotas já existentes de CRM. Leitura parcial ou negada **não** libera dados alternativos nem evita a autorização do servidor.
- Layout com três painéis em desktop amplo: fila, conversa e contexto CRM. Em telas estreitas, o contexto abre por painel lateral; sem duplicar Nginx, ingress ou criar banco.
- Link **Abrir módulo CRM** leva à tela geral do CRM. Não há ainda deep-link para pessoa específica no CRM do Workspace.
- Contatos não vinculados mostram estado vazio explícito. Empresas, tags e atualização de vínculo não aparecem no contexto porque não temos ainda endpoints de leitura detalhada aprovados para eles; não simulamos dados.
- O backend Inbox foi ampliado apenas com parâmetro opcional ``queue=all|mine|unassigned`` na rota de listagem existente. Nenhuma mudança de schema ou migração SQL, apenas filtro de consulta autorizado.
- Testes: TypeScript/Vite, testes unitários de isolamento no Inbox Core e cliente HTTP, Playwright com API/identidade simuladas para filtragem e dados CRM, e testes de layout mobile.
- **Pendências:** autenticar o novo fluxo com Keycloak/OpenFGA e PostgreSQL reais, concluir o Product Gate CRM, paginação real acima de 100 conversas, filtros de busca no servidor, permissões por ação na interface, notas/organizações/tags profundas e realtime/anexos já planejados.

A implantação no DevServer01 somente é válida após **atualizar também o Core Host** com a implementação do filtro; publicar apenas o bundle Vite sobre o backend antigo faria as filas ficarem incorretas. Sempre validar ``queue`` pela rota autenticada e confirmar que outro tenant não aparece. Não usar resultados de testes mockados como prova de autorização real.
