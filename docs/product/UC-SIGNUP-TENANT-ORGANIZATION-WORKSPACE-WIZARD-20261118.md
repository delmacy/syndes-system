# UC-SIGNUP-01 — Wizard de criação da conta Syndes

**Data:** 2026-11-18 · **Estado:** especificação de produto / contrato de aceitação; implementação E2E de signup pendente. **Product Gate: BLOCKED.**

## Objetivo e hierarquia

Um fundador deve conseguir cadastrar sua identidade **exclusivamente no Keycloak**, contratar/criar a conta **Tenant** e configurar uma **primeira Organization** e um **primeiro Workspace** no Syndes, sem conhecer os conceitos de banco, IAM e FGA.

```text
Keycloak (único provedor de identidade e credenciais)
    └── Usuário fundador / subject imutável + Organization Keycloak
Syndes Control (tenant, billing/entitlements, registry, link)
    └── Tenant = conta contratante e fronteira física (1 database)
          └── Organization 1 = empresa / fronteira lógica
                └── Workspace 1 = contexto de trabalho (padrão)
                      └── Funis 0..N — criados somente depois via Service
```

**Cardinalidade permanente:** 1 tenant → N organizations → N workspaces por organization → N funis por workspace. No signup, a criação inicial gera **exatamente 1 org e 1 workspace padrão**. Um segundo contexto é operação posterior e permanece bloqueado pela SQL002 até o Product Gate de multi-organização.

A conta assinante NÃO é um usuário Keycloak, uma Organization não é um tenant, um Workspace não é um funil e `crm_organizations` não é uma Platform Organization.

## Use Case UC-SIGNUP-01

**Ator principal:** responsável pela nova conta comercial (fundador), com acesso ao cliente OIDC PKCE do Syndes; a plataforma controla a identidade assinada e verificada. **Objetivo:** tornar uma conta nova pronta para navegação em um Workspace inicial, sem gerar acesso a módulos não contratados.

**Pré-condições:** Keycloak confiável e acessível; usuário autenticado e email verificado segundo a política do realm; tenant ainda não registrado para essa operação de signup; instalação do stack e do módulo Organizations aprovada; infraestrutura de provisionamento e auditoria disponíveis. O browser nunca recebe credencial administrativa do Keycloak, DSN, segredo SQL ou token FGA.

### Jornada visual proposta do wizard

| Etapa | Interface | Dado do usuário | Validação |
|---|---|---|---|
| 0. Identidade | Redirecionamento Keycloak (não formulário de senha próprio) | Login/cadastro, email/MFA conforme política | JWT assinado, issuer/client/aud, email verificado |
| 1. Minha conta | Nome comercial da conta | Nome da conta; dados fiscais apenas se billing exigir | Validação servidor; disponibilidade comercial, sem conceder tenant automaticamente |
| 2. Minha organização | Nome da primeira empresa | `organizationName` | Nome de 2–160 caracteres; ID gerado e vinculado no servidor a uma Keycloak Organization |
| 3. Meu workspace | Nome do primeiro espaço de trabalho | `workspaceName` | Nome de 2–160 caracteres; workspace default pertence à org recém-criada |
| 4. Revisar e criar | Resumo dos três escopos | Confirmação única | Idempotency key estável + solicitação autenticada |
| 5. Preparação | Progresso recuperável sem bloquear a navegação | Nenhuma credencial | Mostrar status **real** da orquestração, nunca declarar pronto cedo |
| 6. Conclusão | Link para entrar no primeiro workspace | Nenhum | Somente com identidade, Control, DB, Keycloak Org link e escopo consistente |

Em telas pequenas: uma coluna, rótulos persistentes, botão Voltar sem perder rascunho e erros vinculados aos campos. Nunca criar automaticamente funis, contatos, equipe, canais WhatsApp, módulos premium ou contas técnicas com privilégios genéricos.

### Fluxo backend aprovado para implementação posterior

```text
Browser PKCE → Keycloak: autenticação, email verificado
Browser → Signup API: criar/reutilizar intenção de signup idempotente
Signup API → Control: reservar tenant e propriedade do fundador
Operador confiável → Installer: provisionar DATABASE do tenant
Signup API → Keycloak Admin restrito: Organization inicial e membership do fundador
Signup API → Organizations bootstrap: INSERT atômico org + workspace
Signup API → Control IAM link: vínculo 1:1 de Organization Keycloak ↔ platform_organization
Orquestrador → FGA: grants EXATOS mínimos e auditados da ação inicial
Orquestrador → Control: ativar intenção apenas depois de todas as verificações
Browser → Syndes: entrar no workspace com JWT atual e verificações normais
```

**Orquestração ≠ transação única entre Keycloak/Control/tenant/FGA.** Tratar como saga idempotente com checkpoints duráveis, propriedade operacional explícita, reconciliador e auditoria. O estado `ready` só é emitido após comprovação dos vínculos e dos entitlements. Evitar concessão automática de acesso global à Inbox/CRM; conceder apenas bootstrap e capacidades necessárias ao primeiro acesso conforme catálogo vigente.

Estados de negócio propostos para a *intenção* (nenhuma tabela nova nesta entrega): `draft → identity_verified → tenant_reserved → tenant_database_ready → organization_ready → keycloak_link_ready → grants_ready → ready`; erros de provedor transicionam para `reconcile_required`, **não** para `ready`. Cancelar após recursos provisionados exige limpeza controlada ou continuidade reconciliada, nunca apagar dados do cliente silenciosamente. Recuperação deve preservar a mesma chave idempotente, tenant, org e workspace.

**Proposta de APIs (não implementadas):** `POST /v1/signup/intents` com idempotency key; `PUT /v1/signup/intents/:id/draft`; `POST /v1/signup/intents/:id/confirm`; `GET /v1/signup/intents/:id/status`. Todas autenticadas, origin/CSRF/limite de taxa controlados e status somente para o titular validado. UUIDs, DSN, Keycloak org id, proprietário e grants jamais vêm do browser como autoridade.

**Integração já existente e utilizável após provisionamento autorizado:** `POST /v1/tenants/:tenantId/platform/bootstrap`, protegido por Keycloak/Kernel+FGA e membership do tenant, cria primeiro contexto em CTE com `ON CONFLICT DO NOTHING`, grants somente ao primeiro autor e auditoria. Nesta entrega passa a aceitar corpo opcional:
```json
{"organizationName":"Acme Serviços","workspaceName":"Atendimento"}
```
Os nomes são apenas rótulos; ambos validados no servidor e persistidos em parâmetros SQL. Repetir bootstrap **não** modifica proprietário nem reatribui grants. O estado de signup do Control ainda não existe: o endpoint acima NÃO é uma API de criação de tenant e NÃO deve ser chamado por usuários sem identidade/tenant previamente autorizados.

## Histórias de usuário e critérios de aceite

| ID | User story | Aceite testável |
|---|---|---|
| US-SIGNUP-01 | Como fundador, quero me cadastrar sem outra senha do Syndes | Toda credencial e autenticação ficam no Keycloak; JWT inválido/Manager token não cria tenant |
| US-SIGNUP-02 | Como fundador, quero nomear conta, organização e workspace | Nomes próprios aparecem após bootstrap; IDs sempre gerados server-side, isolamento 1 tenant / 1 DB |
| US-SIGNUP-03 | Como fundador, quero retomar se a rede falhar | Mesmo idempotency key jamais gera segundo tenant/org/workspace nem duplica grants |
| US-SIGNUP-04 | Como fundador, quero rever minhas escolhas antes de confirmar | Nenhum recurso persistente nem grant administrativo antes da confirmação, salvo reserva auditada |
| US-SIGNUP-05 | Como operador, quero que falhas parciais sejam recuperáveis | Indisponibilidade Keycloak/PG/FGA resulta `reconcile_required`; acesso bloqueado até consistência |
| US-SIGNUP-06 | Como cliente, quero uma organização com vários workspaces e funis | Primeiro workspace default nasce sem funil; novos contexts apenas após gate, com FKs compostas |
| US-SIGNUP-07 | Como usuário já membro, quero entrar na organização existente | Entrar por convite/context switch, nunca criar outro tenant por padrão |
| US-SIGNUP-08 | Como segurança, quero impedir takeover e privilégios implícitos | Primeira operação com founder verificado + autoridade de tenant; retry não dá admin a segundo usuário; Manager segregado |
| US-SIGNUP-09 | Como usuário mobile, quero concluir com clareza | Etapas progressivas, campos acessíveis, estados reais e retomada sem reenvio de senha |

### Casos negativos obrigatórios

JWT expirado/issuer/client incorretos; email não verificado quando exigido; convite para org existente; tenant reservado por outra identidade; solicitação duplicada em duas abas; nomes vazios/control chars/grandes demais; mudança de dados depois da confirmação; timeout e erro 500 após reservar tenant; falha de criação do DB; falha após criar Organization Keycloak mas antes do link; FGA indisponível; rollback de instalação; reenvio do wizard por segundo usuário; navegação por organização de outro tenant. Cada caso exige erro seguro sem exposição de segredos e sem acesso parcial.

## Plano de implementação e responsabilidade

1. **UC-SIGNUP-01A — contrato e bootstrap:** esta especificação, testes para nomes e CTE idempotente, sem criação de tenant automática.
2. **UC-SIGNUP-01B — Control signup intents e autoridade do fundador:** DDL, roles mínimos, idempotência, revisão, CAS, auditoria e testes PG17.
3. **UC-SIGNUP-01C — orquestrador confiável:** Keycloak Org/admin client mínimo, tenant registry/DB installer e link reconciliado, sem senha no Syndes.
4. **UC-SIGNUP-01D — API e wizard frontend:** endpoints autenticados, UX mobile e retomada, testes de acessibilidade e E2E completos.
5. **UC-SIGNUP-01E — gate:** backup/restore, simulação de falhas entre sistemas, grants restritos, SSL e deploy somente por GitHub CI/CD.

**Fora do escopo nesta entrega:** tela frontend pronta, endpoint público de abertura de tenant, billing/pagamento, convites, templates, criação automática de funil e relaxamento SQL002. Não marcar essas funcionalidades como concluídas por existir uma especificação.
