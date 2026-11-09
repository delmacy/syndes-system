# ADR proposta — Conta, Organizações, Unidades operacionais, Workspaces e Colaboração Interna

**Data:** 2026-11-08
**Estado:** proposta arquitetural incorporada à Fase 0 / Product Gate; **não implementada**.
**Origem:** requisito do produto: um cliente Syndes pode ter diversas organizações, cada organização vários workspaces, unidades opcionais e colaboração entre workspaces e organizações do mesmo cliente.
**Impacto:** Platform Core, identity/tenancy, CRM, Inbox, Gestão de Atendimentos, administração e provisionamento.
**Dependências:** `docs/engineering/SERVICE-MANAGEMENT-PRODUCT-GATE-20261108.md`, `docs/engineering/WBS-SERVICE-MANAGEMENT.md`, ADR dos funis.

## 0. Reserva do conceito de Site: publicação de informações (futuro)

A nomenclatura **Unidade** é definitiva para sede, filial, estabelecimento ou operação física. Usar `Unit` nos contratos de software e `platform_units`, `platform_workspace_units`, `unit_id` no banco. Não chamar unidades físicas de `Site` nem manter colunas `site_id` com esse significado.

**Site** fica reservado para uma capacidade distinta e futura de **publicação e navegação de informações**. Poderá contemplar intranet para colaboradores, extranet/portal para consumidores autorizados e páginas públicas, com conteúdo curado, menus e permissões próprias. Um Site de conteúdo pertence a uma organização publicadora, pode reunir conteúdos de múltiplos workspaces/unidades conforme regras de publicação e **não dá acesso direto ao banco operacional**.

Os conceitos futuros `PublishingSite`, `PublishedPage`, `PublicationAudience` e `PublicationGrant` são somente placeholders de domínio para evitar colisões de nomes; não autorizar desenvolvimento de um CMS nesta fase. O grau de publicidade é explícito por conteúdo/audiência (`public`, `authenticated collaborator`, `authenticated consumer` e grupos/permissões refinadas quando definidos). Não deduzir que um Site interno é acessível a todo usuário da conta, nem que um site de consumidores é público.

**Limite:** Site (publicação digital) ≠ Unidade (local físico) ≠ Workspace (ambiente de trabalho) ≠ Organização (empresa). O módulo de Sites terá Product Gate e WBS próprios quando priorizado.

## 1. Decisão: identidade dos escopos

```text
Tenant / Customer Account (contratante, assinatura e limite físico de banco)
├── Organization A (empresa / entidade empresarial)
│   ├── Unidade 1 (matriz)       [OPCIONAL]
│   ├── Unidade 2 (filial)      [OPCIONAL]
│   ├── Workspace Atendimento ── vinculado às Unidades 1 e 2
│   ├── Workspace TI          ── vinculado às Unidades 1 e 2
│   └── Workspace RH          ── sem necessidade de Unidade obrigatória
└── Organization B (outra empresa do mesmo cliente)
    ├── Unidade 3                [OPCIONAL]
    ├── Workspace Operações   ── vinculado à Unidade 3
    └── Workspace Financeiro  ── escopo da organização

Comunicação/handoff: Workspace ↔ Workspace (mesma organização)
Colaboração: Organization A ↔ Organization B (mesma conta; grant explícito)
```

- **Tenant / Customer Account**: cliente contratante, entidade de billing/entitlements e raiz de isolamento. **Mapeia-se ao `tenant_id` existente e ao banco PostgreSQL por tenant**; não introduzir um segundo conceito de tenant nem redesenhar todos os bancos na Fase 1.
- **Organization**: empresa ou entidade operacional/jurídica sob aquela conta; múltiplas por tenant. Cada organização tem metadados próprios e limites lógicos de visibilidade. Quando entidades independentes exigirem contratos/segregação física diferentes, avaliar contas/tenants distintos; comunicação cross-tenant é escopo separado.
- **Unidade (Unit)**: sede, filial, estabelecimento, fábrica, operação física ou outra localização. É **opcional**, pertence a exatamente uma organização e não é pai obrigatório de workspace. `unit.type` pode expressar `headquarters/branch/other` como metadado, sem impor árvore `matriz → filiais`.
- **Workspace**: contexto lógico de execução, governança e visibilidade configurado pelo cliente; pertence exatamente a **uma organização**, independentemente de fronteiras departamentais. Pode atender zero, uma ou muitas unidades; uma unidade pode utilizar vários workspaces.
- **Team**: conjunto de operadores/pessoas com competências e associação expressa de workspace/funil; é diferente de Workspace, Unidade, grupo de atendimento e grupo WhatsApp.
- **ServiceGroup**: organização visual de funis **dentro do produto Gestão de Atendimentos**, não substitui Organization/Workspace/Unidade.
- **ServiceFunnel**: processo publicado sob Organization e exposto a workspaces por vínculo explícito `workspace_funnels` (N:N). O mesmo processo pode ser reutilizado em vários workspaces sem duplicar definições; políticas/filas são específicas de contexto.
- **ServiceSession**: uma solicitação/protocolo da organização, com `origin_workspace_id` e `current_workspace_id`, além de funil/versionamento. Dentro da mesma organização, handoffs entre workspaces preservam identidade; entre organizações, usar correlação/colaboração explícita (ver §4).

**Critério para distinguir Organização x Unidade x Workspace:**
- outra empresa/entidade, responsabilidade por dados e regras de negócio próprias → Organization;
- unidade/localização/filial da mesma entidade → Unidade;
- divisão de trabalho, equipe, permissão, fila ou processo independentemente da localização → Workspace.

Não vincular recursos por nomes, CNPJ, telefone WhatsApp nem slug livre. IDs imutáveis e verificados.

## 2. Relações e cardinalidade

| Relação | Cardinalidade | Regra |
| --- | --- | --- |
| Tenant → Organizations | 1:N | Ao menos uma organização default em tenant legado; sem máximo fixado em domínio |
| Organization → Unidades | 1:0..N | Unidade é opcional, subordinado à organização |
| Organization → Workspaces | 1:1..N | Toda organização ativa operacional tem um workspace default; pode criar mais |
| Unidade ↔ Workspace | N:N | `platform_workspace_units` garante mesmo tenant e mesma organização |
| Organization → Teams | 1:0..N | Pessoas podem participar de equipes de mais de uma organização com grants separados |
| Team ↔ Workspaces | N:N | Apenas contextos autorizados; não pressupor unidade nem presença |
| Organization → Funis | 1:0..N | Definição mantida no âmbito da organização |
| Funnel ↔ Workspaces | N:N | Exposição explicitamente autorizada; publicação não torna funil global |
| Workspace → filas/protocolos operacionais | Contextual | Sessão possui organização e workspace atual; autorizações do ator se aplicam ao contexto |

**Exemplo:** a ACME Brasil possui matriz em Porto Alegre e filial em São Paulo. Um único Workspace Financeiro gerencia ambas; o Workspace Atendimento atua nas duas; uma fila de TI pode atender todos os unidades. Não criar cópias de Financeiro/TI só porque há duas filiais.

## 3. Persistência e tenancy

### Solução preferencial para o primeiro corte

**Banco PostgreSQL por `tenant_id = conta contratante`**, preservando `tenant_registry` e `tenant_memberships` do Control Plane. Uma conta pode possuir muitas organizações dentro de seu banco. Isso simplifica colaboração interna e evita multiplicação de bancos por filial/departamento. **Isso não significa que organizações no mesmo banco tenham visibilidade mútua.** O isolamento entre organizações/workspaces exige enforcement explícito no servidor, SQL e OpenFGA.

Novas tabelas candidatas **no banco do tenant**, com PKs e FKs compostas, todas com `tenant_id`:

```text
platform_organizations(
  tenant_id, id, display_name, legal_name?, registration_id?,
  status, created_at, archived_at
)
platform_units(
  tenant_id, id, organization_id, name, type?, address_json?,
  status
)
platform_workspaces(
  tenant_id, id, organization_id, name, slug, status, created_at
)
platform_workspace_units(
  tenant_id, organization_id, workspace_id, unit_id
)
platform_workspace_memberships(
  tenant_id, organization_id, workspace_id, principal_id, role/status
)
platform_organization_memberships(
  tenant_id, organization_id, principal_id, role/status
)
platform_teams(
  tenant_id, id, organization_id, name, status
)
platform_team_members(
  tenant_id, organization_id, team_id, crm_employee_id, status
)
platform_team_workspaces(
  tenant_id, organization_id, team_id, workspace_id
)
```

- Verificar ownership de Teams antes de criar, para não duplicar outra capacidade já existente.
- Caso o mapeamento `principal_id ↔ crm_employee_id` seja necessário para atribuição, desenhar uma tabela associativa verificável e auditada, **nunca** supor `Keycloak subject = employee UUID`.
- Invariantes: todos os relacionamentos de Unidade, Workspace, Team e Funnel exigem **mesmo tenant e mesma organization** via FKs compostas; `UNIQUE(tenant_id, organization_id, slug)` para workspaces; grupos/funis devem carregar `organization_id` e vínculos a workspace explícitos.
- Não confundir `platform_organizations` (empresas assinantes) com `crm_organizations` (empresas cadastradas como contatos/relacionamentos comerciais de um tenant).
- Dados de pessoas/contatos CRM podem ser referenciados em várias organizações com grants específicos; NÃO transformar `crm_people` automaticamente em diretório legível por toda a conta. Definir associações/visibilidade antes de habilitar multi-org.
- O `tenant_id` na URL permanece um contexto de entrada verificado, mas `organizationId/workspaceId` não podem ser aceitos como autoridade: o backend valida membership/grants e os vínculos de IDs.
- Um admin de billing/conta não recebe automaticamente `read` em dados de RH, protocolos ou conversas de todas as organizações.

### Migração sem quebra do sistema atual

1. Introduzir tabelas + contratos sem habilitar múltiplas organizações na UI.
2. Provisionar **uma organização padrão** e **um workspace padrão** para o tenant existente. `unit_id` fica ausente.
3. Adaptar as tabelas/associações e rotas atuais de CRM/Inbox para contexto de organização/workspace, com backfill seguro em dados legados. Não assumir que adicionar colunas basta: contatos compartilhados exigem política própria, e a Inbox deve filtrar antes da paginação.
4. Testar account A/B, org A/B e workspace A/B com FGA permissões restritas, inclusive queries de listagem/pesquisa/streaming e links entre recursos.
5. Só após o passo 4, habilitar criação de segunda organização e navegação contextual. **Proibido habilitar multi-org enquanto endpoints legados selecionarem todos os dados do banco só por `tenant_id`.**
6. Rollout em DevServer01 por release aprovado, migrações incrementais, teste de reversão de código, backups e nenhum log persistente verboso.

## 4. Comunicação, colaboração e handoffs

**Não transformar autorização em mero encaminhamento.** Comunicação entre contextos é um produto explícito, com destinatários, consentimento/políticas de compartilhamento e auditoria.

**A. Entre workspaces da mesma organização**
- Abrir conversa/solicitação de colaboração interna, atribuir a workspace de destino ou transferir atendimento, respeitando grants de origem/destino.
- Se é a **mesma solicitação**, preservar `ServiceSession`/protocolo e registrar origem, destino, ator, motivo, timestamp e revision; atualizar `current_workspace_id` de forma transacional.
- O destinatário não recebe automaticamente acesso a tudo que o workspace anterior podia ler; aplicar a política do caso e compartilhar apenas o contexto necessário.

**B. Entre organizações da mesma conta**
- Permitir solicitação, conversa interna e cooperação autorizada com participantes identificados por `organization_id`/`workspace_id`.
- Compartilhamento de informações é **explícito** (resumo/campos/documentos selecionados) e com trilha de acesso; nenhum join/cópia integral implícito.
- Em transferência de uma solicitação entre empresas potencialmente distintas, preferir **protocolo próprio na organização de destino** e um `correlation_id` comum, com referência auditável cruzada. Não confundir correlação com compartilhamento irrestrito de histórico.
- O protocolo de origem pode permanecer encaminhado/aguardando resposta/concluído conforme política, com status próprio. Origem não adquire permissão de leitura do caso do destino.
- Se for colaboração sem transferência de responsabilidade, manter dois workspaces/organizações participantes num thread interno, não falsificar movimentação de funil.

**C. Mensagens internas**
- Modelar `collaboration_thread`, `collaboration_participants`, `collaboration_messages` e `collaboration_events` como **contratos futuros** sob Inbox/serviço de colaboração, não dentro de Whatsmeow.
- Um thread pode vincular `service_session`(s), mas não é um protocolo e não altera histórico canônico de WhatsApp.
- Nenhuma mensagem interna ou marcador é enviada a números WhatsApp. Exigir verificação de participante e ator para leitura/escrita, auditoria append-only, proteção contra retransmissão/duplicação e política de anexos depois.

**D. Entre clientes/tenants diferentes**
- Fora do escopo do primeiro ciclo. Exige fronteira contratual, compartilhamento explícito e transporte/eventos entre bancos distintos. Não expor API que consulta diretamente outro tenant sob pretexto de colaboração.

## 5. Autorização e contexto de UI

- Fluxo de login único: **Keycloak → membership no tenant → organizações autorizadas → workspaces autorizados → módulos e dados daquele contexto**. Alternar workspace não autentica novamente nem altera privilegios.
- OpenFGA deve conceder ações por recurso/contexto e negar por padrão. Não inferir autorização de `tenant_memberships`; membership na conta só permite entrar na conta, não ler cada organização.
- Recurso pode ser compartilhado entre workspaces explicitamente; um token/JWT do usuário não prova acesso ao workspace enviado no request. Backend valida a operação em cada comando, inclusive stream SSE, busca, export, anexos, handoffs e protocolos.
- Extensão de API proposta: `GET /v1/tenants/:tenantId/organizations`; `/organizations/:orgId/units`; `/organizations/:orgId/workspaces`; `/organizations/:orgId/workspaces/:workspaceId/... ` para recursos contextuais **somente após** gates de segurança. Preservar caminhos legados sob contexto default durante migração, sem fallback ambíguo de múltiplas organizações.
- UI do Workspace: seletor compacto de **Organização / Workspace** integrado ao cabeçalho ou rodapé; Unidade como filtro operacional contextual, não terceiro login/menu fixo. Na Inbox, manter navegação contextual de números/conversas sem duplicar sidebar.
- **Seletor não é barreira de segurança.** O servidor sempre aplica contexto autenticado e políticas. O usuário nunca pode manipular IDs para ampliar alcance.

## 6. Operação por tenant, custo e trade-offs

| Opção | Benefício | Custo / risco | Decisão |
| --- | --- | --- | --- |
| DB por conta/tenant, organizações e workspaces no mesmo DB | Compatível com infraestrutura atual, colaboração simples, custo menor | Exige isolamento lógico muito bem testado entre organizações e workspaces | **Recomendado agora** |
| DB por organização | Maior separação física entre empresas | Mais pools, segredos, migrações, relatórios e colaboração entre bancos | Reservar para clientes/compliance que exijam isolamento próprio |
| Unidade obrigatório entre organização e workspace | Hierarquia simples de visualizar | Impede workspaces que cobrem vários unidades e cria duplicação | **Rejeitado** |
| Workspace filho de Unidade ou Workspace único por departamento | Implementação mais simples | Inadequado para times matriciais ou multiunidade | **Rejeitado** |
| Unidade opcional com relação N:N | Abrange matriz/filial e trabalho matricial | Exige tabela associativa e UI de filtro | **Recomendado** |

## 7. Alteração de prioridade na WBS

A topologia é **fundação transversal**, não uma feature cosmética de F1. Incluir:
- **F0.7** — aprovar Account/Organization/Unit/Workspace, scopes, ownership, defaults e migração;
- **F0.8** — análise de impacto sobre CRM/Inbox e matriz de autorização A/B org/workspace;
- **F1.0** — capacidade base `platform_organizations`, `platform_units`, `platform_workspaces`, memberships e `workspace_units`, com tenant legado migrado para defaults, **antes do catálogo de funis**;
- **F1.0b** — adaptar leituras de CRM/Inbox e validar isolamento antes da criação da segunda organização; pode exigir entrega transversal independente do catálogo;
- **F1.3** — funis vinculados à Organization e expostos aos Workspaces via N:N;
- **F4/F5** — protocolo com `organization_id` + workspaces de origem/atual e transferências autorizadas;
- **F5.C** — colaboração cross-organization e cross-workspace, threads e links de protocolo com grants explícitos;
- **F6** — Inbox filtrada por organização/workspace, sem quebrar histórico WhatsApp.

**Primeiro corte vertical:** uma conta existente → organização default → workspace default → nenhum unidade obrigatório → catálogo de funis scoped; provar negações antes de habilitar múltiplas organizações. Não antecipar chat interorganizacional completo no primeiro PR.

## 8. Gate de aceite da topologia

1. Uma conta cria duas organizações, cada uma com workspaces independentes, **após** migração das APIs existentes.
2. Uma organização opera sem unidade; outra possui matriz+filial; um workspace pode cobrir ambos.
3. Administrador só visualiza organizações autorizadas; conta/billing admin não lê RH sem grant.
4. Usuário em Org A/Workspace X não lê dados da Org B/Workspace Y sem grant explícito, mesmo que `tenant_id` seja igual.
5. Busca/paginação/SSE/CRM/Inbox negam leituras cross-org/workspace e impedem vazamento por IDs.
6. Transferência dentro da organização preserva protocolo e audita.
7. Comunicação entre organizações não copia dados sensíveis implicitamente e não atravessa tenancy.
8. Tenant legado continua operável em sua organização/workspace default sem perda de histórico.
9. Gates de CI, migração, rollback de código e testes estão registrados por SHA.

**Status:** decisões de desenho recomendadas; **não implementado nem homologado**. Product Gate técnico deve autorizar a migração antes de executar mudanças cross-module.
