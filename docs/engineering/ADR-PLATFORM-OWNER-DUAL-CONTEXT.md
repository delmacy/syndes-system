# ADR — Proprietário global, operação própria da Syndes e delegação por escopo

**Data:** 2026-11-09
**Status:** arquitetura proposta para implementação incremental; não constitui autorização para bootstrap global, novo tenant, migração, ativação de módulos ou deploy.
**Relacionamentos:** Platform Manager (PR #33), Syndes Support (issue #32), Product Gate multi-organização (issue #31), isolamento Organization/Workspace (issue #21), `ADR-PLATFORM-MANAGER-BOUNDARY.md`, `ADR-ACCOUNT-ORGANIZATION-UNIT-WORKSPACE-PROPOSAL.md`.

## 1. Decisão: o operador tem identidades e atribuições, não um tipo de tenant privilegiado

O proprietário da plataforma atua em duas frentes distintas:

**A. Syndes Platform Manager — Control Plane.** Console administrativo exclusivo, em frontend, client OIDC, audience, API e conexão PostgreSQL dedicados. Permite governança do serviço e metadados comerciais de clientes de acordo com capacidades expressamente autorizadas. Não usa Core Host nem o banco privado dos clientes. No MVP da PR #33, owner/operator/viewer apenas consultam resumo/diretório/detalhes. Novas ações administrativas precisam de PRD e Product Gate.

**B. Syndes Operations Workspace — Tenant Plane.** A própria fornecedora Syndes é uma conta contratante/tenant de primeira parte, com `tenant_id` e banco de tenant **normais**. Dentro dessa conta podem existir Organization(s), Unit(s) opcionais, Workspace(s), equipes, operadores, CRM, Inbox, Support, agenda e os demais módulos somente conforme disponibilizados a clientes. Esta frente usa **o mesmo produto, código e contratos do Syndes Workspace**, não uma cópia especial de CRM/Inbox nem um supertenant. Os workspaces de Atendimento, Operações, RH ou TI são exemplos de contextos; só criar telas/módulos quando estiverem implementados e aprovados.

Uma mesma pessoa pode possuir atribuições **independentes** de plataforma e de tenant, mas um grant NÃO cria o outro. Para o proprietário global em produção, recomendar também identidade **privilegiada separada** (conta Keycloak de administração, MFA/step-up e sessões curtas) da conta de uso diário; isso requer desenho e testes de SSO. No desenvolvimento, o mesmo `sub` pode representar a mesma pessoa em dois clients OIDC, mas tokens/audiences/autorização nunca são intercambiáveis. Não adotar nem a única identidade ativa no realm como owner por inferência.

### Topologia lógica

```text
PESSOA / PRINCIPAL DO KEYCLOAK
  |-- [platform_operator_access: grant explícito] --> PLATFORM MANAGER
  |       frontend+OIDC+audience+API+DB-role do Control Plane
  |       cadastro comercial e governança da plataforma, sem banco tenant
  |
  `-- [tenant membership + OpenFGA + org/workspace membership] --> WORKSPACE
          |-- Conta operacional Syndes (tenant comum)
          |       |-- Organização Syndes
          |       |     |-- Workspace Atendimento / Support
          |       |     `-- outros workspaces conforme módulos habilitados
          |       `-- banco próprio da conta Syndes
          `-- Conta de qualquer outro cliente, APENAS se receber grant explícito
```

A separação entre as duas frentes é uma **fronteira de segurança**, não apenas duas entradas no menu. Não adicionar a UI de atendimento ou funcionários à imagem `apps/master-admin-web`. Podem ser reutilizados componentes visuais versionados, mas o Workspace mantém frontend e autorização próprios. Um link de transição, quando aprovado, deve realizar novo fluxo OIDC e escolha autorizada de contexto, sem passar JWT em query string e sem `iframe` com sessão administrativa.

## 2. Vocabulário e perfis de negócio (sem fingir que estão implementados)

| Escopo / denominação | Capacidade pretendida | Limite obrigatório | Estado |
| --- | --- | --- | --- |
| `platform_owner` — Proprietário da plataforma | Governança global e eventual delegação de operadores | Somente Control Plane, nunca dados privados automáticos | MVP atual usa `platform_operator_access.role='owner'`, somente leitura |
| `platform_operator` — Operador de plataforma | Administração limitada por ação | Nunca equivalente a `platform_owner` ou gestor de cliente | MVP usa `role='operator'`, somente leitura |
| `platform_viewer` — Auditor/consulta | Visibilidade controlada de metadados | Sem mutação ou dados privados | MVP usa `role='viewer'` |
| `account_owner` — Titular da conta contratante | Responsabilidade administrativa do contrato, pessoas autorizadas e configurações da conta | Uma conta/tenant específico; não presume leitura de chats privados de todas as organizações | **Proposto**; `tenant_memberships` atual não possui role diferenciada |
| `account_admin` — Administrador delegado da conta | Gestão operacional permitida do tenant | Limites delegados pelo titular e auditados | **Proposto** |
| `organization_admin` — Administrador da organização | Configurações e participantes daquela organização | Não altera outra organização nem concede `platform_*` | Já existe `platform_org_memberships.role='admin'` para certas ações; nomenclatura/atribuições futuras exigem revisão |
| `workspace_manager` / `supervisor` — Responsável de equipe/workspace | Alocação, filas, equipe, procedimentos e supervisão conforme módulos publicados | Somente workspaces/recursos expressamente autorizados; sem superacesso a dados sensíveis | **Proposto**; role física atual `admin/editor/viewer` em `platform_workspace_memberships` |
| `agent` / `viewer` — Atendente/consulta | Atender, consultar ou editar recursos atribuídos | Autorização por recurso, fila, organização e workspace | Parcialmente coberto por `editor/viewer`; capacidades específicas ainda planejadas |

**Terminologia para a situação descrita pelo usuário:** `Account Owner` (titular/responsável pela conta) quando o funcionário é o responsável por administrar a empresa contratante; `Organization Admin` para gerir uma das empresas da conta; `Workspace Manager` ou `Supervisor` para gerir um setor/equipe de atendimento. Não chamar todos de `manager`, pois isso confundiria com o **Platform Manager**, que é um produto/console de infraestrutura.

## 3. Autorização: contexto + papel + capacidade + recurso

A decisão de acesso operacional deve considerar conjuntamente:

`allow = identity(sub, iss, aud, azp) AND tenant_membership(active) AND organization_membership(active) AND workspace_membership(active quando exigida) AND OpenFGA(action, resource) AND resource_scope_match(tenant, org, workspace)`.

- O navegador envia identificadores apenas como **seleção solicitada**, nunca como prova de autoridade.
- O backend confirma vínculo ativo e que o recurso pertence exatamente ao contexto de tenant/org/workspace. Alterar um header ou UUID não altera as permissões.
- Não implementar `isMaster || isAdmin` como atalho em query, Inbox, CRM, SSE ou atendimento; `platform_owner` não é `tenant_admin`.
- Configurações de alto impacto precisam de capacidades explícitas (`staff.manage`, `org.settings.manage`, `workspace.members.manage`, `support.queue.assign`, etc.) e trilha de auditoria. Esses nomes são propostas de contrato, **não endpoints já existentes**.
- Se um funcionário é o responsável por um cliente, registrar autorização administrativa da **conta daquele cliente**, com delegação/revogação auditável; ele não herda direitos de outros clientes nem da plataforma.

## 4. Atendimento da própria Syndes e suporte aos clientes da plataforma

O atendimento externo e interno da fornecedora acontece na **Organization/Workspace da conta Syndes**, pelo módulo Syndes Support aprovado no planejamento próprio. Os clientes da Syndes podem abrir solicitações ou ser contatos de atendimento; isso não exige que atendentes sejam membros do banco/Workspace de cada cliente.

**Duas relações separadas**:
1. **Atender o cliente:** protocolo/ticket mantido no tenant operacional da Syndes, com vínculo de referência do cliente, seus contatos, histórico do atendimento e políticas próprias de consentimento/visibilidade. O evento/ticket não concede poder sobre dados privados do tenant cliente.
2. **Acessar dados privados para resolver um incidente:** só por mecanismo futuro de **Support Access Grant** com `tenant_id`, organização/workspace ou recurso, `operator_sub`, ticket, finalidade, ações permitidas, expiração, aprovação/delegação e auditoria imutável. Deny by default, revogação imediata, proibição de impersonation silenciosa e testes A/B. Este fluxo é outro Product Gate, não parte do MVP de consulta.

Não criar atalhos do diretório de clientes no Platform Manager diretamente para Inbox ou CRM dos clientes. Se houver navegação, somente para um fluxo de solicitação de suporte autorizada, nunca para leitura direta.

## 5. Compatibilidade com o que existe hoje

- `platform_operator_access` vive no **Control DB** e contém roles `owner/operator/viewer`; não recebe tenant/org/workspace nem concede participação operacional.
- `tenant_registry` e `tenant_memberships` identificam contas e pertencimento; `tenant_memberships` atual **não define titular/gestor da conta**.
- O tenant DB já contém `platform_org_memberships` e `platform_workspace_memberships` com `admin/editor/viewer`. Antes de introduzir `account_owner`, `supervisor` e outros perfis, especificar tabelas/grants e migrations sem quebrar esses enums existentes.
- O Core Kernel já exige membership de tenant e política positiva; a resolução de contexto operacional já exige org e workspace ativos, restringe edição conforme papel e mantém o Product Gate SQL 002. Nunca abrir múltiplas organizações ou workspaces por configuração/UI apenas.
- A conta operacional Syndes deve ser provisionada por fluxo regular, auditado e reversível após aprovação do Product Gate; **não transformar o tenant de demonstração/cliente existente em Syndes automaticamente**.

## 6. Interface e segurança das duas frentes

- **Platform Manager:** manter navegação MVP atual `Visão geral` e `Clientes`. Nenhum menu falso de Atendimento/Funcionários. Expansões administrativas futuras exigem contrato e testes.
- **Syndes Operations:** utilizar exatamente o mesmo Workspace modular entregue ao cliente, com branding/contexto da Organização Syndes e somente módulos realmente disponíveis. Gestão de pessoal, atendimento e contratos entram quando seus módulos estiverem aprovados, não como telas vazias.
- **Transição entre experiências:** link opcional para origem separada do Workspace com autenticação específica, autorização verificada pelo servidor e sem token compartilhado; nunca embutir o frontend do cliente dentro do bundle administrativo.
- **Privacidade:** sessão/token de plataforma não pode ser usado na API tenant; sessão/token Workspace não pode consultar o Control Plane. Conta privilegiada idealmente protegida por MFA forte e autenticação adicional ao entrar no Platform Manager.

## 7. WBS de evolução com gates

| WBS | Entrega | Dependência e gate de aceite |
| --- | --- | --- |
| DC-1 | Registrar ADR, matriz de perfis e limites entre Control/Tenant Plane | Revisão de produto e segurança; não modifica privilégios existentes |
| DC-2 | Contrato de capacidades e delegação por tenant/org/workspace; diferenciar titular, administrador, supervisor e agente | Desenhar migrations e políticas OpenFGA; negativos por tenant/org/workspace; auditoria e revogação |
| DC-3 | Provisionar conta operacional Syndes (tenant convencional) e primeira Organization/Workspace | Governança e Product Gate #31, backup e rollback; nenhum cliente existente alterado |
| DC-4 | Integração do usuário que opera em dois contextos e, para proprietários globais, conta privilegiada separada | Testes de client OIDC, audiences, PKCE, MFA/step-up e token-cross; UI sem compartilhar tokens |
| DC-5 | Gestão de funcionários, equipes, responsáveis e permissões no Workspace | Produto/módulo próprio, APIs, testes e UX planejados antes de desenvolver frontend |
| DC-6 | Atendimento interno e externo Syndes Support na conta Syndes | Issue #32; tickets e contatos sem acesso nativo aos bancos de clientes |
| DC-7 | Delegação temporária de suporte em tenants de clientes, se necessária | Outro Product Gate com consentimento, TTL, motivo, aprovação, FGA, auditoria e negações |
| DC-8 | Rollout progressivo, operações e documentação | CI amplo, DB e navegador reais, revalidação SQL 002, isolamento, rollback, monitoramento |

**Fora de escopo desta ADR:** autorização para selecionar automaticamente a única conta ativa no Keycloak como proprietário global, ativação de novos papéis SQL, merge de PR #33, interface fictícia, impersonação ou acesso automático a bancos de clientes.
