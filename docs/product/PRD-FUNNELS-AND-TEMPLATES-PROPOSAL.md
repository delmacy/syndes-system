# PRD — Construtor de Funis, Templates e Gestão de Atendimentos (PROPOSTA)

**Status:** proposta para decisão de escopo; não implementado nem aprovado como substituto do MVP atual.
**Data:** 2026-11-08
**Responsável pelo processo:** administrador autorizado do tenant.
**Relação com documentos existentes:** complementa a Inbox/CRM; requer decisão de Product Gate antes de alterar docs/product/MVP-SCOPE.md e docs/product/MODULE-ORDER.md.

## 1. Problema e objetivo

A Syndes possui comunicação contínua por canal (atualmente WhatsApp/Whatsmeow) e Inbox com atribuição e estado da conversa. Clientes precisam definir, por organização, **processos próprios de atendimento**, que podem abranger atendimento externo, RH, helpdesk, agendamentos ou qualquer outro domínio. Esses exemplos **não** devem virar funis fixos no código.

Objetivo: permitir que um tenant configure grupos, funis, etapas, transições, resultados, equipes e políticas; instancie templates; publique versões; execute protocolos rastreáveis; transfira entre funis/equipes sem perder contexto; e escolha visualizações adequadas para operador, supervisor e administrador.

## 2. Princípios não negociáveis

1. **Configuração por tenant:** a Syndes entrega primitivas e templates opcionais, nunca etapas obrigatórias universais.
2. **Separação de dimensões:** equipe = quem atende; funil = processo; etapa = posição; política = como priorizar/atribuir; estado = situação; resultado = condição final; protocolo = identidade da solicitação.
3. **N:N entre funis e equipes:** uma equipe pode operar muitos funis; um funil pode admitir várias equipes, sob autorizações distintas.
4. **Um mesmo funil pode ter múltiplas classes de serviço:** premium/standard/urgente etc. são exemplos de políticas, não exigem duplicação de etapas.
5. **Conversas não são atendimentos:** WhatsApp mantém histórico contínuo e identificadores canônicos; protocolos/marcadores existem na camada Syndes, sem alterar mensagens de provedor.
6. **Versionamento:** uma versão publicada não muda em silêncio; novas execuções usam a versão ativa, em andamento preservam a referência anterior, salvo migração auditada.
7. **Mesma operação, múltiplas portas:** Inbox, Home, Kanban e Inspector acessam o mesmo serviço e verificações no Core Host, sem duplicar regras no frontend.
8. **Segurança por origem e destino:** transferir entre funis ou grupos não concede automaticamente visibilidade de dados de RH, clientes ou outras equipes.
9. **Sem motor arbitrário no primeiro corte:** etapas/transições declarativas e comandos autorizados, não código do tenant nem integrações programáveis irrestritas.
10. **Separação de UX:** o operador recebe fila consolidada de trabalho; o gestor acompanha funis, capacidade e exceções; o administrador configura.

## 3. Papéis e superfícies

- **Administrador do tenant:** cria grupos e funis, vincula equipes, instala templates, configura políticas, valida e publica.
- **Supervisor do funil:** acompanha filas, distribui, transfere, audita e intervém conforme permissões.
- **Operador:** vê somente protocolos autorizados, próprios ou em fila elegível, e executa transições permitidas.
- **Administrador da plataforma:** administra habilitação e provisioning, sem acesso automático às solicitações do tenant.

Telas planejadas:
- **Meus Funis:** busca, agrupamento, versão publicada, rascunhos, responsáveis, criar/clonar.
- **Criador de Funis:** identidade e grupo; etapas e transições; equipes; resultados; publicação com validação.
- **Biblioteca de Templates:** oficiais e privados do tenant; prévia e instalação como novo rascunho, nunca publicação automática.
- **Operação / Kanban vertical:** filas/seções configuráveis, filtros e protocolo clicável, com opção de lista.
- **Minha Fila / Home do operador:** atendimentos de funis distintos numa fila autorizada consolidada.
- **Inspector da Inbox:** protocolo, etapa, responsável, histórico e ações contextuais; Agenda apenas após backend real.

## 4. Requisitos do primeiro ciclo (MVP do módulo, NÃO do MVP comercial original)

### F0 — Fundamentos
- Grupos por tenant, funis por grupo, etapas com chaves estáveis, transições manuais válidas e 1+ resultados finais.
- Vínculo N:N entre funil e equipe já reconhecida pelo tenant; não duplicar identidades do CRM.
- CRUD com estados rascunho / publicado / arquivado, publicação que cria snapshot imutável e valida entrada/saídas/alcance.
- Autorização servidor + isolamento no banco do tenant; sem operações anônimas.
- Modelo de protocolo com ID interno imutável, protocolo público único por tenant e vínculo opcional à conversa/pessoa.

### F1 — Templates e execução
- Templates iniciais opcionais, versionados, clonáveis e editáveis depois da instalação.
- Abrir protocolo, registrar entrada de etapa, atribuir responsável, avançar/retornar manualmente onde permitido, registrar resultado e encerrar.
- Transferência entre funis mantendo protocolo quando for continuidade da mesma solicitação; manter trilha de passagem e checar autorização no destino.
- Eventos append-only de abertura, atribuição, mudança de etapa, transferência, resolução e reabertura.
- Para trabalho paralelo, permitir no futuro subprotocolos, em vez de dois donos concorrentes da mesma etapa.

### F2 — Integração de canais e visualização
- Mensagens da Inbox seguem sem reclassificação retroativa automática; associação explícita ou política versionada para abertura de atendimento.
- Marcadores de início, transferência, resolução e reabertura pesquisáveis no histórico contínuo.
- Visualização filtrada por protocolo sem excluir mensagens do histórico canônico.
- Fila pessoal e Kanban vertical são **projeções** do motor, não estados salvos independentemente por cada tela.

## 5. Não fazer agora

- Editor de scripts do cliente, marketplace, BPMN completo, motor universal de automações ou custom code.
- SLA com calendários complexos, plantões, skills, round-robin, capacity e escalonamento automático: reservar interfaces de domínio; entregar por fases posteriores.
- Cobrança por execução de workflow, regras genéricas de integração, microserviços separados por funil.
- Agendamentos falsos: link com Scheduling só quando a API real existir.
- Criar dados fictícios em produção para preencher Home, métricas ou protocolos.

## 6. Casos de aceite

1. Admin do tenant cria funil livre com etapas nomeadas, salva rascunho, valida e publica v1.
2. Mesmo funcionário/equipe participa de 2 funis distintos; mudança num não altera o outro.
3. Template oficial é clonado para o tenant sem copiar usuários, segredo ou dados de cliente.
4. Duas políticas operacionais podem coexistir no mesmo funil sem exigir etapas duplicadas (parâmetros básicos no segundo ciclo).
5. Operador autorizado abre atendimento, muda etapa permitida, conclui e consulta eventos.
6. Transferência preserva protocolo e audita origem/destino; acesso ao destino é revalidado.
7. Alterar rascunho e publicar v2 não muda a v1 de protocolos ativos.
8. Busca por protocolo encontra marcadores no histórico contínuo; conversas e recibos WhatsApp seguem intactos.
9. Tenant B e usuário sem capacidade não leem, publicam, transferem ou alteram dados do tenant A.
10. Falha concorrente de mudança de etapa responde conflito em vez de sobrescrever silenciosamente.

## 7. Plano por incrementos (PRs pequenos)

| Incremento | Entrega | Gate para avançar |
|---|---|---|
| 0 — Produto/ADR | Decisões, contrato de dados e limites do MVP | PRD aprovado; requisitos de segurança aceitos |
| 1 — Modelos | Grupos, definições, versões e equipe N:N em pacote montável | Migrações idempotentes + testes tenant e autorização |
| 2 — Criador | Formulário, etapas, transições, rascunho e publicar | CRUD e publish E2E, acessibilidade básica |
| 3 — Templates | Catálogo, prévia, clonar e versionamento | Sem cópia de IDs internos/segredos; isolamento |
| 4 — Protocolos | Runtime, eventos, etapas e resultados | Transições inválidas bloqueadas; auditoria íntegra |
| 5 — Integração Inbox | Vínculos de mensagens, marcadores e inspector | WhatsApp/histórico/receipts/regressão sem perda |
| 6 — Operação | Minha fila e Kanban vertical configurável | Operador vê apenas autorizações e fila correta |
| 7 — Políticas avançadas | SLA, calendário, classes, escalas, presença, capacidade | Testes de prioridade, relógio e concorrência |
| 8 — Scheduling | Próxima ação e condições de conclusão por compromisso | Agendamentos reais com autorização e timezone |

Em cada PR: GitHub como fonte da verdade → CI (build, testes, isolamento, migrações) → homologação → rollout versionado e reversível no DevServer01. **Não antecipar deploy de infraestrutura sem o gate do incremento.**

## 8. Decisões de produto ainda abertas (não bloquear o protótipo conceitual)

- Este módulo entra no MVP comercial original ou passa a ser um ciclo de produto separado?
- Quais três templates opcionais iniciais demonstram melhor valor sem induzir processos rígidos?
- Transferência cross-funnel troca somente a execução atual ou exige subprotocolo em quais cenários?
- Quais ações do cliente exigem aprovação de supervisor e quais são auditáveis sem aprovação?
- Como nomear o produto na navegação: Funis, Processos de Atendimento ou Gestão de Atendimentos?

**Recomendação:** usar “Gestão de Atendimentos” como área, “Funis” como configuração e “Protocolos” como execução.


## 9. Novo requisito de produto — multi-organização e workspaces (2026-11-08)

**Decisão de produto solicitada:** uma única conta contratante Syndes deve suportar múltiplas organizações (empresas) e vários workspaces por organização, com colaboração autorizada entre workspaces e organizações do mesmo cliente. `Unidade` (sede/filial/unidade) é **opcional** e tem vínculo N:N com Workspace, não é um pai estrutural obrigatório.

- `Tenant/Account` = cliente da Syndes, assinatura e limite físico de isolamento por banco.
- `Organization` = empresa/entidade empresarial da conta, com seus dados e políticas.
- `Workspace` = área de trabalho lógica configurada pelo cliente, como departamento, processo, equipe ou operação transversal. Pertence a uma organização.
- `Unidade` = estabelecimento/unidade física opcional, pertence a uma organização; workspaces podem operar em várias unidades sem duplicação.
- `Team` = conjunto de pessoas autorizadas a executar; não confundir com `Workspace`, `Organization` nem grupo WhatsApp.
- Grupo de atendimento, funil e protocolo **não** são organização, unidade ou workspace. Um funil pode ser compartilhado entre workspaces autorizados da mesma organização.

**Experiência:** após login único, o usuário escolhe somente entre organizações e workspaces autorizados; unidade é filtro contextual quando aplicável. Não adicionar uma segunda barra lateral à Inbox. Uma pequena empresa pode operar em uma organização e workspace default, sem preencher cadastro de filiais.

**Comunicação:** entre workspaces de uma mesma organização, uma solicitação transferida preserva protocolo, versão e auditoria; entre organizações do mesmo cliente, comunicação interna e solicitações ligadas por `correlation_id` devem exigir grants explícitos, evitando exposição integral da conversa, dos anexos e de dados sigilosos. Colaboração entre tenants/clientes diferentes é uma fase posterior.

**Critério bloqueador:** NÃO disponibilizar criação de múltiplas organizações enquanto CRM/Inbox e endpoints legados listarem dados apenas por `tenant_id` sem filtros e autorização org/workspace. É necessário migrar contextos/defaults e testar isolamento antes de liberar o recurso.

**Escopo/entrega:** a topologia e as migrações transversais entram antes do catálogo dos funis na WBS. A comunicação interorganizacional completa é uma entrega posterior vinculada ao motor de protocolos; não se presume implementada na versão inicial.

Detalhes e critérios de aceite: `docs/engineering/ADR-ACCOUNT-ORGANIZATION-UNIT-WORKSPACE-PROPOSAL.md`.


### Nomenclatura definitiva: Unidade e Site (CR-002)

**Unidade** representa sede, filial, estabelecimento ou operação física da organização e substitui o termo anterior `Site` nas entidades administrativas. É opcional e se relaciona N:N com Workspaces. Na interface: **Unidades**. No código: `Unit`, `platform_units`, `platform_workspace_units` e `unit_id`.

**Site** é reservado ao futuro módulo de publicação de conteúdo navegável para colaboradores, consumidores e eventualmente público externo, com políticas de audience, autenticação, autorização e publicação próprias. Não é uma Unidade nem um Workspace. Não desenvolver Sites no incremento do Catálogo de Funis. O conteúdo publicado só pode expor dados previamente autorizados, nunca prover acesso implícito aos registros internos.
