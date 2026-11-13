---
title: "G02 · Requisitos e casos de uso"
description: "Volume Produto e módulos de negócio · capítulo G02 · matéria 02"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/02-requisitos-historias-e-casos-de-uso.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 2. Requisitos, histórias de usuário e casos de uso

As histórias abaixo são **representações resumidas de jornadas presentes em PRDs já versionados**, para descoberta. Os IDs/aceites normativos permanecem nos documentos proprietários; esta página **não cria novos requisitos aprovados**.

### Matriz de requisitos, ator, fonte e aceite

| Referência de origem | Ator / intenção | Ação descrita | Evidência necessária para aceite |
|---|---|---|---|
| [CRM MVP](https://github.com/delmacy/syndes-system/blob/main/docs/product/CORE-CRM-MVP-ACCEPTANCE.md) | Operador autorizado gerencia contatos | Criar, buscar, editar, arquivar e relacionar pessoa/organização, notas e tags | API de CRM, negativa cross-tenant, capacidade por recurso, browser com Keycloak/FGA reais |
| [PRD-002](https://github.com/delmacy/syndes-system/blob/main/docs/product/PRD-002-INBOX-ACCEPTANCE.md) | Atendente responde conversa | Consultar fila/histórico, assumir, responder, nota privada, handoff, estado | Atribuição/identidade verificada, ordem cronológica, 401/403, perfil real e UX responsiva |
| [PRD-003A](https://github.com/delmacy/syndes-system/blob/main/docs/product/PRD-003A-GESTAO-ATENDIMENTOS-MVP.md) | Gestor configura processo Basic | Etapas ordenadas por contexto autorizado; etapa terminal | API real, persistência, validação de configuração e isolamento por tenant/org/workspace |
| [PRD-003A](https://github.com/delmacy/syndes-system/blob/main/docs/product/PRD-003A-GESTAO-ATENDIMENTOS-MVP.md) | Atendente opera protocolo | Abrir idempotente, atribuir, mover etapa válida, concluir e auditar | Protocolo imutável, versão/409, transições não permitidas bloqueadas, histórico atômico |
| [PRD-003A](https://github.com/delmacy/syndes-system/blob/main/docs/product/PRD-003A-GESTAO-ATENDIMENTOS-MVP.md) | Supervisor transfere dentro do Workspace | Transferir atendimento à equipe de destino autorizada | Workforce real, grants revalidados, sem conceder acesso por mera atribuição |
| [PRD Support](https://github.com/delmacy/syndes-system/blob/main/docs/product/PRD-SYNDES-SUPPORT.md) | Solicitante/operador Syndes | Abrir e acompanhar Case externo/interno | Tenant Syndes e filas segregadas; notas internas nunca enviadas ao WhatsApp |
| [ADR frontend](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md) | Usuário seleciona contexto | Operar Account/Organization/Workspace pelo mesmo app de tenant | Contexto e permissões no backend; troca descarta caches/requisições/SSE do escopo anterior |

### Casos de uso narrativos de consulta (derivados; não novos Product Gates)

**UC-G02-A — Atendimento humano:** autenticado como membro autorizado de Workspace → visualizar apenas fila elegível → abrir conversa → consultar histórico e contexto CRM permitido → responder ou anotar → verificar falhas/negações e estado de atendimento. **Domínios proprietários:** P02/P01/P03, com P05 quando houver protocolo; teste com API mockada é diferente de aceite com grants reais.

**UC-G02-B — Atendimento Basic:** gestor autorizado define etapas → atendente abre protocolo opcionalmente ligado a conversa do mesmo contexto → atribui a usuário elegível → avança apenas transição válida → conclui e consulta trilha append-only. **Owners:** P05, P04, P02; aceites normativos em PRD-003A.

**UC-G02-C — Gestão global:** operador do Platform Manager consulta metadados administrativos do tenant por API separada; ações não exigidas/permitidas pelo contrato não devem ser exibidas. **Não** traduzir ownership global em permissão de leitura da Inbox/CRM.

### Requisitos não funcionais transversais

| Dimensão | Critério rastreado | Estado de comprovação |
|---|---|---|
| Privacidade e autorização | Nenhuma leitura/gravação cross-tenant; JWT, membership e autorização server-side; segredos segregados | Exigir testes negativos reais por perfil e ambiente; não comprovados pela G02 |
| Usabilidade e acessibilidade | Fluxos completos no desktop/mobile, teclado e estados loading/erro/403 explícitos | Testes mockados registrados em CRM/Inbox; aceite de acessibilidade completo pendente |
| Consistência | Idempotência de inbound/comandos e concorrência de protocolo | Verificar nos owners e testes PG17, não presumir em produção |
| Recuperação | Backup/restore, rollback, monitoramento e erros não silenciosos | Requisito de lançamento, não homologado nesta auditoria |
| Experiência de comunicação | Conversa permanece canônica; histórico e mensagens não desaparecem por efeito de mudança de etapa | Validação E2E necessária com canais e dados autorizados |
| Desempenho | Metas/carga conforme gates do programa | Não preencher percentis ou SLAs sem medição |

A tabela sintetiza decisões rastreadas. **Não** executar criação automática de Issues, aceite ou alteração de código a partir dessas histórias.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/02-requisitos-historias-e-casos-de-uso.md).
