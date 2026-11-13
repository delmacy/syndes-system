# Plano de atualização documental por módulo — Syndes System

> **Sequência de auditoria, não plano de execução de features.** Snapshot baseado em catálogo, WBS, escopos e STATUS versionados em 12/11/2026. As descrições na tabela são hipóteses de **escopo a conferir**; não afirmam implementação ou deploy.

## Situação da documentação

- **57 unidades:** 49 principais e 8 componentes documentais vinculados. Os vínculos não criam módulos executáveis novos.
- **10 STATUS com auditoria técnica parcial registrada:** G01, G02, G03, Q10, Q07, Q01 (fontes e testes) e P14, P01, P02, P03. **47 STATUS** ainda mostram baseline documental sem auditoria funcional verificada. A CI mainline foi aprovada na revisão `bd0aa69`; módulos e produto mantêm seus Product Gates independentes.
- O marcador `maturity` do catálogo é metadado de inventário, não sinônimo de integração/produção/homologação.
- A [WBS do programa](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md) e a [ordem funcional](https://github.com/delmacy/syndes-system/blob/main/docs/product/MODULE-ORDER.md) permanecem as fontes de priorização de entrega.

## Procedimento padrão por unidade

1. **Baseline (as-is):** conferir SHA de origem, branch, owner, arquivos, comportamento real, stack e revisão dos ambientes. Registrar o que foi observado, distinguindo código de implantação.
2. **Descrição de domínio:** documentar missão, responsabilidades, escopo, exclusões, atores, requisitos funcionais/não funcionais, histórias, casos de uso e capabilities. Manter propostas diferentes de requisitos aprovados.
3. **Contratos e dados:** reconciliar exports públicos/privados, classes/métodos, APIs e erros, eventos versionados e consumers, entidades/agregados, schemas/migrations, dependências e diagramas, com fontes de arquivo/linha.
4. **Evidências:** testar unitário, contrato, integração, isolamento tenant/org, E2E e operação conforme risco e módulo; registrar comandos, resultados e ambiente sem atribuir resultados de um SHA a outro.
5. **Governança:** ligar especificação, STATUS, SPRINT, WBS, Issues/Projects, commits, bloqueadores e próximo marco. Atualizar STATUS como **resumo indexador**, não duplicar nele o conteúdo técnico.
6. **Publicação:** revisar diff, verificar o owner, testar e documentar. Uma alteração em contrato de outro módulo requer decisão própria; prompts não substituem escopo/permissões.

## Campos de status que devem ficar separados

| Dimensão | Valores documentais aceitos |
|---|---|
| Documentação | baseline, auditoria parcial, reconciliada, revisada/aprovada |
| Implementação | não verificada, fonte encontrada, testada localmente |
| Integração | não verificada, sintética, ambiente descartável validado, ambiente-alvo validado |
| Operação | não verificada, deploy identificado, smoke validado, homologada |
| Bloqueios | pendente, bloqueado por gate, congelado por decisão, sem bloqueio conhecido |

**Regras:** os eixos não são um percentual; um módulo pode ter documentação completa e deploy não verificado. Nunca publicar segredos, IPs internos, senhas ou configuração administrativa sensível em página pública.

## Sequência integral (57 unidades)

A execução de testes críticos é transversal desde a primeira onda. A Onda 5 audita a documentação dos seus próprios módulos, não autoriza adiar os gates das ondas anteriores.

### Onda 0 — Governança, qualidade e núcleo

Acordar critérios de evidência, ownership, escopo e arquitetura antes de detalhar a implementação.

| Ordem | Unidade / fonte de status | Descrição e escopo a conferir | STATUS inicial |
|---:|---|---|---|
| 01 | [G01 — Arquitetura](../subprojects/G01-arquitetura/README.md) · [STATUS](../subprojects/G01-arquitetura/STATUS.md) | Arquitetura, decisões e fronteiras entre domínios e owners. | **Parcial — fontes/ADRs reconciliadas; aprovação pendente** |
| 02 | [G02 — Produto e UX](../subprojects/G02-produto-e-ux/README.md) · [STATUS](../subprojects/G02-produto-e-ux/STATUS.md) | Jornadas, requisitos de produto, UX e critérios de aceite. | **Parcial — PRDs/UX reconciliados; Product Gates pendentes** |
| 03 | [G03 — Engenharia e Git](../subprojects/G03-engenharia-e-git/README.md) · [STATUS](../subprojects/G03-engenharia-e-git/STATUS.md) | Engenharia, Git/worktrees, AGENTS e rastreabilidade. | **Parcial — regras/CI e Projects inventariados; aprovação pendente** |
| 04 | [Q10 — Quality Gates](../subprojects/Q10-quality-gates/README.md) · [STATUS](../subprojects/Q10-quality-gates/STATUS.md) | Gates de qualidade, critérios e evidências exigidas. | **Parcial — integridade inventariada; CI Q07 recuperada, Product Gates pendentes** |
| 05 | [Q07 — CI/CD](../subprojects/Q07-ci-cd/README.md) · [STATUS](../subprojects/Q07-ci-cd/STATUS.md) | CI central, seleção de testes e promoção por revisão. | **Parcial — CI mainline validada (24/24 no SHA ec688ce); aceite de produto separado** |
| 06 | [Q01 — Plataforma de testes](../subprojects/Q01-plataforma-de-testes/README.md) · [STATUS](../subprojects/Q01-plataforma-de-testes/STATUS.md) | Plataforma de testes, ambientes, fixtures e execução. | **Parcial — suites/ambientes identificados, CI verde por SHA; RC pendente** |
| 07 | [P14 — Platform Core](../subprojects/P14-platform-core/README.md) · [STATUS](../subprojects/P14-platform-core/STATUS.md) | Core lógico: P14 contratual, Kernel A08, Host A04, Control/Identity; CMP planejado. | **Parcial — contratos/owners reconciliados; perfis CMP não implementados** |

### Onda 1 — Hospedagem, identidade e segurança

Identificar ambientes, dados/tenancy, identidade, autorização, segredos e limites entre aplicações.

| Ordem | Unidade / fonte de status | Descrição e escopo a conferir | STATUS inicial |
|---:|---|---|---|
| 08 | [I02 — Hospedagem e ambientes](../subprojects/I02-server02/README.md) · [STATUS](../subprojects/I02-server02/STATUS.md) | Hospedagem por ambiente, hosts e composição sem dados sensíveis. | Baseline; não auditado |
| 09 | [I04 — PostgreSQL](../subprojects/I04-postgresql/README.md) · [STATUS](../subprojects/I04-postgresql/STATUS.md) | PostgreSQL, Tenant/Control DB, schemas, roles e migrations. | Baseline; não auditado |
| 10 | [C01 — Control Plane](../subprojects/C01-control-plane/README.md) · [STATUS](../subprojects/C01-control-plane/STATUS.md) | Control Plane, tenants, grants, organizações e segregação. | Baseline; não auditado |
| 11 | [C03 — Identity Keycloak](../subprojects/C03-identity-keycloak/README.md) · [STATUS](../subprojects/C03-identity-keycloak/STATUS.md) | Keycloak, OIDC, clients, JWT, audiences e sessões. | Baseline; não auditado |
| 12 | [C04 — Authorization OpenFGA](../subprojects/C04-authorization-openfga/README.md) · [STATUS](../subprojects/C04-authorization-openfga/STATUS.md) | OpenFGA, relações, autorizações e negativas de acesso. | Baseline; não auditado |
| 13 | [C05 — Secrets OpenBao](../subprojects/C05-secrets-openbao/README.md) · [STATUS](../subprojects/C05-secrets-openbao/STATUS.md) | OpenBao, segredos runtime, políticas e rotação. | Baseline; não auditado |
| 14 | [A06 — Account Access API](../subprojects/A06-account-access-api/README.md) · [STATUS](../subprojects/A06-account-access-api/STATUS.md) | Acesso da conta, memberships e limites da API. | Baseline; não auditado |
| 15 | [I05 — Docker e redes (componente de I02)](../subprojects/I05-docker-e-redes/README.md) · [STATUS](../subprojects/I05-docker-e-redes/STATUS.md) | Docker, redes, volumes, isolamento e serviços. | Baseline; não auditado |
| 16 | [I06 — Traefik HTTPS (componente de I02)](../subprojects/I06-traefik-https/README.md) · [STATUS](../subprojects/I06-traefik-https/STATUS.md) | Traefik, TLS, rotas e certificados por ambiente. | Baseline; não auditado |
| 17 | [I07 — Tailnet (componente de I02)](../subprojects/I07-tailnet/README.md) · [STATUS](../subprojects/I07-tailnet/STATUS.md) | Tailnet e perímetro de administração privada. | Baseline; não auditado |
| 18 | [I08 — Komodo (componente de I02)](../subprojects/I08-komodo/README.md) · [STATUS](../subprojects/I08-komodo/STATUS.md) | Komodo e operações de gestão de serviços. | Baseline; não auditado |
| 19 | [I12 — Segurança de host (componente de I02)](../subprojects/I12-seguranca-de-host/README.md) · [STATUS](../subprojects/I12-seguranca-de-host/STATUS.md) | Hardening do host, segurança e atualização. | Baseline; não auditado |
| 20 | [G04 — Privacidade](../subprojects/G04-privacidade/README.md) · [STATUS](../subprojects/G04-privacidade/STATUS.md) | Privacidade, PII, retenção e governança de dados. | Baseline; não auditado |

### Onda 2 — Kernel, Host, eventos e continuidade

Descrever ports, composição, instalação, Event Bus/Outbox, adapters, logs, backup e rollback.

| Ordem | Unidade / fonte de status | Descrição e escopo a conferir | STATUS inicial |
|---:|---|---|---|
| 21 | [A08 — Core Kernel](../subprojects/A08-core-kernel/README.md) · [STATUS](../subprojects/A08-core-kernel/STATUS.md) | Core Kernel, ports, contratos tipados e lifecycle. | Baseline; não auditado |
| 22 | [A04 — Core Host](../subprojects/A04-core-host/README.md) · [STATUS](../subprojects/A04-core-host/STATUS.md) | Core Host, composição, workers e roteamento runtime. | Baseline; não auditado |
| 23 | [C02 — Tenant Installer](../subprojects/C02-tenant-installer/README.md) · [STATUS](../subprojects/C02-tenant-installer/STATUS.md) | Tenant Installer, provisionamento e migrations seguras. | Baseline; não auditado |
| 24 | [C06 — Event Platform](../subprojects/C06-event-platform/README.md) · [STATUS](../subprojects/C06-event-platform/STATUS.md) | Event Bus, envelopes, outbox, idempotência, replay e consumers. | Baseline; não auditado |
| 25 | [C07 — APIs e adapters](../subprojects/C07-apis-e-adapters/README.md) · [STATUS](../subprojects/C07-apis-e-adapters/STATUS.md) | APIs e adapters, imports permitidos e limites de integração. | Baseline; não auditado |
| 26 | [C08 — Audit e observabilidade](../subprojects/C08-audit-e-observabilidade/README.md) · [STATUS](../subprojects/C08-audit-e-observabilidade/STATUS.md) | Auditoria, métricas, observabilidade e limites de PII. | Baseline; não auditado |
| 27 | [I10 — Backup e Restore](../subprojects/I10-backup-e-restore/README.md) · [STATUS](../subprojects/I10-backup-e-restore/STATUS.md) | Backup, restauração, RPO/RTO e ensaios comprovados. | Baseline; não auditado |
| 28 | [I11 — Release e Rollback](../subprojects/I11-release-e-rollback/README.md) · [STATUS](../subprojects/I11-release-e-rollback/STATUS.md) | Release, rollback, gates, SHA/digest e verificação. | Baseline; não auditado |

### Onda 3 — Organizações, Manager e interfaces

Confirmar fronteiras Control/Tenant, estrutura organizacional, APIs e frentes de UI independentes.

| Ordem | Unidade / fonte de status | Descrição e escopo a conferir | STATUS inicial |
|---:|---|---|---|
| 29 | [P04 — Organizations & Workforce](../subprojects/P04-organizations-workforce/README.md) · [STATUS](../subprojects/P04-organizations-workforce/STATUS.md) | Organizações e Workforce; distinguir pessoas CRM e staff. | Baseline; não auditado |
| 30 | [A05 — Manager API](../subprojects/A05-manager-api/README.md) · [STATUS](../subprojects/A05-manager-api/STATUS.md) | Manager API, domínio global e isolamento dos tenants. | Baseline; não auditado |
| 31 | [A07 — Front Shared](../subprojects/A07-front-shared/README.md) · [STATUS](../subprojects/A07-front-shared/STATUS.md) | Front Shared e reuso visual sem compartilhar sessão. | Baseline; não auditado |
| 32 | [A02 — Platform Manager Frontend](../subprojects/A02-platform-manager-frontend/README.md) · [STATUS](../subprojects/A02-platform-manager-frontend/STATUS.md) | Frontend do Platform Manager, autorização e interface global. | Baseline; não auditado |
| 33 | [A01 — Workspace Frontend](../subprojects/A01-workspace-frontend/README.md) · [STATUS](../subprojects/A01-workspace-frontend/STATUS.md) | Workspace tenant: UX, rotas, contexto e módulos permitidos. | Baseline; não auditado |

### Onda 4 — Caminho do MVP e atendimento

Respeitar sequência funcional CRM → Inbox → WhatsApp → Atendimento Basic, com Support relacionado.

| Ordem | Unidade / fonte de status | Descrição e escopo a conferir | STATUS inicial |
|---:|---|---|---|
| 34 | [P01 — CRM](../subprojects/P01-crm/README.md) · [STATUS](../subprojects/P01-crm/STATUS.md) | CRM: pessoas, relações, tags, notas e histórico. | **Parcial; revalidar SHA** |
| 35 | [P02 — Inbox](../subprojects/P02-inbox/README.md) · [STATUS](../subprojects/P02-inbox/STATUS.md) | Inbox: conversas, filas, operadores, handoff e atribuições. | **Parcial; revalidar SHA** |
| 36 | [P03 — WhatsApp](../subprojects/P03-whatsapp/README.md) · [STATUS](../subprojects/P03-whatsapp/STATUS.md) | WhatsApp: contas/canais, mensagens, estados e integração. | **Parcial; revalidar SHA** |
| 37 | [I09 — Whatsmeow runtime (componente de P03)](../subprojects/I09-whatsmeow-runtime/README.md) · [STATUS](../subprojects/I09-whatsmeow-runtime/STATUS.md) | Whatsmeow: gateway Go subordinado ao WhatsApp. | Baseline; não auditado |
| 38 | [P05 — Gestão de Atendimentos](../subprojects/P05-gestao-de-atendimentos/README.md) · [STATUS](../subprojects/P05-gestao-de-atendimentos/STATUS.md) | Gestão de Atendimentos Basic, estados e regras do fluxo. | Baseline; não auditado |
| 39 | [P06 — Syndes Support](../subprojects/P06-syndes-support/README.md) · [STATUS](../subprojects/P06-syndes-support/STATUS.md) | Syndes Support: atendimento da plataforma interno/externo. | Baseline; não auditado |
| 40 | [A03 — Support Frontend](../subprojects/A03-support-frontend/README.md) · [STATUS](../subprojects/A03-support-frontend/STATUS.md) | Frontend de Support, jornadas e sessões separadas. | Baseline; não auditado |
| 41 | [G05 — Operação e suporte](../subprojects/G05-operacao-e-suporte/README.md) · [STATUS](../subprojects/G05-operacao-e-suporte/STATUS.md) | Operação e suporte, runbooks, incidentes e escalonamento. | Baseline; não auditado |

### Onda 5 — Testes, infraestrutura observada e release

Auditar resultados de suítes e composição real; executar testes necessários desde a primeira onda.

| Ordem | Unidade / fonte de status | Descrição e escopo a conferir | STATUS inicial |
|---:|---|---|---|
| 42 | [Q02 — Testes unitários](../subprojects/Q02-testes-unitarios/README.md) · [STATUS](../subprojects/Q02-testes-unitarios/STATUS.md) | Testes unitários, cobertura relevante e resultados por SHA. | Baseline; não auditado |
| 43 | [Q03 — Integração](../subprojects/Q03-integracao/README.md) · [STATUS](../subprojects/Q03-integracao/STATUS.md) | Integração intermodular, eventos, persistência e falhas. | Baseline; não auditado |
| 44 | [Q04 — Browser E2E](../subprojects/Q04-browser-e2e/README.md) · [STATUS](../subprojects/Q04-browser-e2e/STATUS.md) | Browser E2E, UX, auth real e negativas cross-tenant. | Baseline; não auditado |
| 45 | [Q05 — Segurança](../subprojects/Q05-seguranca/README.md) · [STATUS](../subprojects/Q05-seguranca/STATUS.md) | Segurança e matrizes de autorização e acesso negado. | Baseline; não auditado |
| 46 | [Q09 — Infra Tests](../subprojects/Q09-infra-tests/README.md) · [STATUS](../subprojects/Q09-infra-tests/STATUS.md) | Infra Tests, healthcheck e consistência de configurações. | Baseline; não auditado |
| 47 | [Q08 — Release Engineering](../subprojects/Q08-release-engineering/README.md) · [STATUS](../subprojects/Q08-release-engineering/STATUS.md) | Release Engineering, artefatos, versões e reversão. | Baseline; não auditado |
| 48 | [I01 — DevServer01 (componente de I02)](../subprojects/I01-devserver01/README.md) · [STATUS](../subprojects/I01-devserver01/STATUS.md) | DevServer01: composição e runbooks do desenvolvimento. | Baseline; não auditado |
| 49 | [I03 — win1-server (componente de I02)](../subprojects/I03-win1-server/README.md) · [STATUS](../subprojects/I03-win1-server/STATUS.md) | win1-server: composição do host dentro da hospedagem. | Baseline; não auditado |

### Onda 6 — Capabilities futuras e pós-MVP

Registrar como contrato/proposta até aprovação de Product Gate; não afirmar operação.

| Ordem | Unidade / fonte de status | Descrição e escopo a conferir | STATUS inicial |
|---:|---|---|---|
| 50 | [P07 — Scheduling](../subprojects/P07-scheduling/README.md) · [STATUS](../subprojects/P07-scheduling/STATUS.md) | Scheduling, agendas, disponibilidade e conflitos. | Baseline; não auditado |
| 51 | [P08 — AI Assistant](../subprojects/P08-ai-assistant/README.md) · [STATUS](../subprojects/P08-ai-assistant/STATUS.md) | AI Assistant, contexto autorizado, conhecimento e handoff. | Baseline; não auditado |
| 52 | [P09 — Documents](../subprojects/P09-documents/README.md) · [STATUS](../subprojects/P09-documents/STATUS.md) | Documents, arquivos, metadados e acesso. | Baseline; não auditado |
| 53 | [P10 — Email](../subprojects/P10-email/README.md) · [STATUS](../subprojects/P10-email/STATUS.md) | Email, envio/recepção e integração como canal. | Baseline; não auditado |
| 54 | [P11 — Onboarding](../subprojects/P11-onboarding/README.md) · [STATUS](../subprojects/P11-onboarding/STATUS.md) | Onboarding e etapas de ativação do cliente. | Baseline; não auditado |
| 55 | [P12 — Billing](../subprojects/P12-billing/README.md) · [STATUS](../subprojects/P12-billing/STATUS.md) | Billing, uso, assinatura e futura apuração de cobrança. | Baseline; não auditado |
| 56 | [P13 — Commercial Site](../subprojects/P13-commercial-site/README.md) · [STATUS](../subprojects/P13-commercial-site/STATUS.md) | Commercial Site, apresentação e entrada de interessados. | Baseline; não auditado |
| 57 | [Q06 — Performance](../subprojects/Q06-performance/README.md) · [STATUS](../subprojects/Q06-performance/STATUS.md) | Performance: carga, metas não funcionais e medições. | Baseline; não auditado |

## Modelo mínimo de checkpoint para STATUS

| Campo obrigatório | Regra |
|---|---|
| Identificação | ID, owner, data, SHA/branch, ambiente observado |
| Situação | Dimensões de documentação, código, integração, operação e bloqueios separadas |
| Evidência | Arquivos, linhas, testes executados, resultado, CI/deploy verificados |
| Fronteiras | Responsabilidade, exclusões, consumidores/contratos, isolamento de tenant |
| Projeto | WBS/Issue/Project associados, sem inferir estado por associação |
| Próximo marco | Entregável verificável, pré-requisitos, gate/aceite e dependências |

## Critérios de conclusão da revisão

- O módulo possui descrição e exclusões claras em `ESCOPO.md` ou seus capítulos; responsabilidades pertencem ao owner certo.
- Cada aba (APIs, Dados, Contratos, Código, Dependências, Testes, Operação, Projetos) aponta para evidência ou declara **não verificado**. Não inventar endpoints, tabelas ou contratos.
- `STATUS.md` registra o que foi testado, o que não foi, o SHA e o próximo gate; homologação não é inferida de testes locais.
- O material público evita topologia interna, credenciais e dados dos clientes. Mudanças em migrations/identidade exigem aprovação separada.

## Próxima ação de auditoria

Começar por **G01 → G02 → G03 → Q10 → Q07 → Q01 → P14**; posteriormente atravessar segurança, Core e as integrações do MVP. Para o negócio, manter **P01 CRM → P02 Inbox → P03 WhatsApp → P05 Gestão de Atendimentos Basic** conforme o plano de produto. O I09 acompanha a auditoria do P03. A ordem é de **documentação**; não muda o Product Gate vigente.
