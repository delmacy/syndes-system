# ADR — Composição definitiva de frontend e backend do Syndes

**Decisão arquitetural do produto, 2026-11-10.** Baseline de código observado: main f537b2bfac542dbe4121631cc6f9ff03fcf96daa.
**Estado:** decisão consolidada para implementação incremental, NÃO autorização para deploy, acesso a dados reais ou remoção dos gates atuais.
**Referências:** ADR-CONTROL-TENANT-MODULE-COMPOSITION-20261110.md, ADR-ACCOUNT-ORGANIZATION-UNIT-WORKSPACE-PROPOSAL.md, FRONT-SHARED-ADR.md, CORE-MODULE-MOUNTING.md, AK-10-04-CONTROL-ENABLED-MODULE-GATE-20261110.md, WBS-PROGRAMA-SYNDES-20261110.md.

## 1. Decisão vinculante de composição

Separar **aplicações frontend por público/ambiente de confiança**; dentro do Workspace, organizar funcionalidades por feature. Separar **módulos backend por domínio** com os mecanismos de integração NestJS já existentes. Não criar um microfrontend, serviço HTTP independente ou banco para cada módulo sem necessidade demonstrada.

- **Platform Manager (Control Plane):** apps/master-admin-web + apps/master-admin-api. Origem HTTPS, cliente OIDC/audience, build, deploy, credenciais, grants SQL e redes separados. É administração global de metadados. A própria fornecedora Syndes deve ter, à parte, uma conta operacional convencional para trabalhar como qualquer tenant. A identidade humana pode ser a mesma, mas tokens e permissões não são.
- **Tenant Workspace (Customer Plane):** apps/workspace-web, um único frontend React do cliente para Account, Organization e Workspace. O frontend usa exclusivamente APIs do contexto tenant e, quando aplicável, o serviço separado apps/account-access-api. Login único de Workspace, mas cada ação tem autorização de recurso e escopo no servidor.
- **UI compartilhada:** packages/front-shared, apenas primitivos de UI e estilos de apresentação; nunca tokens, FGA, tenantId, stores de sessão, fetch, regras de domínio ou roteamento compartilhado.
- **Backend operacional:** apps/core-host compõe packages NestJS confiáveis de modules/*, compartilha ports de identidade/autorização/DB e valida dependências. packages/core-kernel define contratos e gates, não telas.
- **Control Plane de módulos:** syndes_control armazena catálogo, entitlement, instalação, ativação e auditoria. Um operador técnico apartado executa SQL de tenant e atesta; frontend não tem credenciais de instalador e Manager não conecta a banco tenant.
- **Persistência:** um PostgreSQL DB por tenant/Customer Account; esquemas de módulos por domínio são evolução planejada. Módulo habilitado no catálogo não é prova de schema instalado, execução autorizada ou permissão individual.

Não inventar um segundo frontend chamado "Account Web" ou "Organization Web". Account, Organization e Workspace são áreas/contextos do mesmo apps/workspace-web. Manager fica em outro app.

## 2. Taxonomia e cardinalidades

Account = Customer Account / tenantId = titular da assinatura e do isolamento físico da base.
Uma Account pode ter N Organizations (empresa/entidade do cliente).
Uma Organization tem 1..N Workspaces operacionais (com um default no modelo inicial).
Unidades físicas são opcionais e pertencem a uma Organization; uma unidade se vincula a N Workspaces e vice-versa. Team é conjunto de trabalhadores/operadores com grants específicos, e não sinônimo de Workspace.
Um usuário pode ser associado a mais de uma Organization/Workspace do mesmo tenant, sem herança implícita de privilégios.

**Vocabulário essencial para evitar colisão de dados:** Platform Organization (empresa gerida dentro da Account) NÃO é CRM Organization (empresa/cliente/fornecedor cadastrada como contato do CRM). As duas aparecem hoje em APIs com nomes parecidos: platformOrganizations versus organizations no client; manter contratos distintos e rotular a UI de forma inequívoca. Não migrar nem mesclar tabelas dessas entidades apenas por compartilharem o nome "Organization".

## 3. Responsabilidades dos três contextos no mesmo frontend

**Account:** dados da conta, titularidade, membros administrativos, privilégios, assinatura/limites e acesso a cobrança quando o respectivo módulo existir. Acesso Account Owner/Admin não concede, sozinho, leitura de CRM, Inbox, mensagens ou dados de outra Organization.

**Organization:** seleção de empresa e, após contratos/API aprovados, administração de suas unidades, membros, políticas e workspaces. A criação multi-org permanece condicionada à issue #21 e ao Product Gate #31; não remover os índices/SQL 002 para mostrar um seletor fictício.

**Workspace:** execução do trabalho diário. Mostra apenas funcionalidades autorizadas para o tenant, para o contexto Organization/Workspace e para o usuário: Inbox, CRM, WhatsApp e demais módulos efetivamente disponíveis. Inbox/CRM não são apps independentes nem um login novo.

Fluxo de navegação pretendido:
  Login Workspace → escolher contexto autorizado (Organization + Workspace)
  → shell/rota de Account, Organization ou Workspace → feature existente.
Trocar contexto precisa descartar caches, SSE, permissões derivadas, requests em voo e UI do escopo anterior. Não permitir seleção de Org/Workspace por IDs arbitrários; servidor precisa conferir membership e FGA em TODA operação, inclusive workers e mensagens.

## 4. Fonte da verdade da composição de funcionalidades

O NestJS já carrega trusted plugins listados em apps/core-host/config/modules.json com loadInstalledPlugins, valida ModuleRegistry e importa apiModule de cada pacote. **Isso significa módulo compilado e montado no Host, NÃO módulo permitido em todos os tenants**.

Para o frontend:
1. Organizar features existentes sob apps/workspace-web/src/features, sem realocar a implementação operacional para modules/*.
2. Introduzir, quando necessário, um **registro tipado simples das features existentes**, com identificador de módulo, rota, título e componente. Não criar microfrontends, carregador de JS remoto, runtime marketplace ou SDK genérico.
3. A disponibilidade/visibilidade das features será derivada de uma API tenant autenticada de capabilities e módulos efetivamente ENABLED, nunca dos privilégios do Manager, de claims arbitrárias do browser ou de um catálogo global. A API precisará cruzar Control entitlement+install+approval+dependencies com membership e authorization do ator. Projetar contrato antes de adicioná-la.
4. O backend continua fazendo a checagem em cada request e job (ModuleAccessPort + identidade + membership + FGA). Ocultar menu não protege endpoint.
5. Manter features que já existem no MVP; não adicionar Scheduling, Billing, automações ou relatórios como ativos por estarem apenas planejados. Falhas de API não se transformam em false "0 módulos" nem liberam funcionalidades.

**Compatibilidade histórica:** modules/core-crm/plugin.ts ainda declara assets de UI legada em rotas /crm. Esses assets empacotados no backend são uma superfície de compatibilidade a inventariar, não justificam mover a interface principal React para os módulos. Não removê-los sem medir consumidores e aceitação de rollback.

## 5. Estado confirmado no código vs gates

| Decisão / contrato | Estado no baseline main | Lacuna de aceite |
| --- | --- | --- |
| Dois frontends separados, builds e OIDC próprios | Código presente em apps/master-admin-web e apps/workspace-web | Deploy real do Manager e auth/roles operacionais ainda pendentes; :9446 é visual-only |
| Componentes compartilhados sem sessão | packages/front-shared presente, consumido pelos dois apps | Não duplicar componentes; extrair apenas se houver dois consumidores |
| Composição de NestJS plugins | Concluída para pacotes confiáveis, listados em config/modules.json | Não há hot plug nem isolamento de código não confiável |
| Workspace modular por feature | CRM, Inbox, Settings, Overview em features; App.tsx ainda define menu e views manualmente | Separar shell, contexto e registry simples sem alterar comportamento |
| Organization/Workspace no UI | Seletor autorizado e TenantApi.withScope com headers no App.tsx | Fallback legado sem contexto, E2E de troca e gates #21/#31 abertos |
| Camada Account no UI | Login/tenantId, dados de sessão; Account Access separado com contratos | Falta área Account genuína e read model autenticado; não usar placeholders |
| ModuleAccessPort integrado ao Kernel | Código integrado; chamadas executeModule contempladas | Controllers/jobs legados ainda usam execute; transição tenant segura pendente |
| Control migrations e módulo ENABLED | Scripts e adapters candidatos em main | No Control DB operacional ainda ausentes; backup/restore real e identity grants pendentes |
| Manager inventário de módulos | Endpoint read-only e UI de detalhe do tenant presentes em código | Schema read-only/Manager homologados ainda pendentes |

**Não confundir:** IMPLEMENTADO ≠ INTEGRADO ≠ TESTADO ≠ IMPLANTADO ≠ HOMOLOGADO.

## 6. Regras para implementação incremental

- Preservar apps/master-admin-web, apps/workspace-web e packages/front-shared; não renomear ou duplicar os projetos para seguir o diagrama.
- O primeiro refactor frontend é estrutural, não visual: manter a UI, os fluxos, os rótulos e o escopo MVP atuais. Só acrescentar telas quando uma API/capability e Product Gate correspondentes existirem.
- Separar shell/contexto de features sem refazer CRM/Inbox em lote; usar testes de regressão atuais, Keycloak, PG17 e browser. Comprovar ausência de vazamento de caches/SSE durante troca de escopo.
- Control DB/read model do Manager não é a API de módulos para o Workspace; não reutilizar tokens ou acesso SQL do Manager.
- Fallback legado sem org/workspace deve ser eliminado apenas após backfill, teste de dados/rotas/workers e gate de tenant; enquanto existir, não declarar multi-org seguro.
- SQL 002 e os limites provisórios de org/workspace não devem ser removidos implicitamente.
- Não alterar infra operacional, backups, firewall, DB, roles, Keycloak, OpenBao, OpenFGA, Docker ou CI nesta ADR.
- Mudanças futuras no código ocorrem por fatias pequenas e PRs com CI central no SHA correto. Não tocar a worktree principal do DevServer01 com alterações de outro chat.

## 7. Arquiteturas rejeitadas

**Frontend dentro de cada backend module:** acopla NestJS e React, duplica pipelines e dificulta composição de conta/workspace; não usar como padrão. Reconhecer assets legados do CRM como exceção histórica, não modelo alvo.

**Microfrontend por CRM/Inbox/etc:** complexidade de build, distribuição, dependências, runtime, autenticação e segurança sem ganho no MVP. Reavaliar só diante de necessidade comprovada de deploy independente por time/domínio.

**Frontend Account separado:** torna o usuário refém de apps/SSO para operar a própria conta. Account, Organization e Workspace são contextos da aplicação de tenant.

**Manager como superusuário de dados tenant:** viola isolamento de cliente; metadados globais ficam no Control DB, dados do cliente acessados só por grants operacionais explícitos e auditados.

**Marketplace dinâmico agora:** os plugins NestJS atuais são confiáveis, compilados e instalados no build. Catalogar e habilitar tenant não instala código arbitrário em runtime.

## 8. Próxima decisão executiva

**Congelar o alvo arquitetural e executar as fatias da WBS-FRONTEND-BACKEND-COMPOSITION-20261110.md.** Priorizar hardening dos gates operacionais e decomposição do App.tsx; não iniciar primeiro por billing/relatórios/novos módulos. O contrato de produto comercial permanece no MVP-SCOPE.md e MODULE-ORDER.md.
