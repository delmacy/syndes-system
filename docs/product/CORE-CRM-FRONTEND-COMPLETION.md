# Core CRM — fechamento das tarefas de frontend do Workspace

**Data de implementação:** 2026-11-01
**Código:** `feat/crm-workspace-completion` (branch dependente de `feat/inbox-crm-context-composer`/PR #12)
**Situação:** funcionalidades implementadas e testadas localmente; **sem homologação real de login, sem release de produção e sem autorização para marcar Product Gate DONE**.

## Objetivo e limites

Encerrar as tarefas previamente acordadas de interface do Core CRM, mantendo `@syndes/core-crm` como domínio canônico de pessoas, organizações, tags, funcionários, identidades de canais e notas. Nenhum novo módulo comercial, objeto de oportunidade ou pipeline foi criado.

## Funcionalidades da interface implementadas

| Tarefa | Implementado | Observações |
| --- | --- | --- |
| Listagem e busca de pessoas e organizações | Sim | Filtradas no backend, com paginação via `limit`/`offset`, 25 por página no Workspace |
| Cadastro de pessoa e organização | Sim | Validação no backend; e-mail/telefone, fantasia e CPF/CNPJ quando aplicáveis |
| Edição e arquivamento | Sim | Formulários reutilizados; arquivamento soft-delete com confirmação |
| Ficha de pessoa e contexto | Sim | E-mail, telefone, empresas, tags, notas, canais, funcionário e timeline |
| Vincular/desvincular organizações | Sim | Escrita `crm:relationships`; deleção do vínculo com auditoria |
| Criar, reutilizar e desvincular tags | Sim | Leitura e escrita `crm:tags`; sem alteração no catálogo global fora do tenant |
| Notas, histórico e canais externos | Sim | Canais WhatsApp/Instagram/e-mail são apenas identidades no CRM, **não** envio por essas redes |
| Perfil de funcionário | Sim | Consulta pelo ID da pessoa; não equivale à criação de conta no Keycloak |
| Detecção de duplicados | Sim | Checagem de email/telefone antes de salvar e confirmação explícita quando há candidato |
| Importação/exportação CSV | Sim | Até 500 linhas/1 MiB na importação; CSV exportado com neutralização de fórmulas, limite de 1.000 |
| Interface por capacidades | Sim | `GET /crm/capabilities` derivado de permissões OpenFGA por recurso/ação; não usa `isAdmin` |
| Mobile e estados de erro | Sim, teste mockado | Ficha em painel lateral, carregamento/negações explícitas |

**Observação:** a API usa permissões `read/write` para cada recurso; ainda não existem permissões distintas para `create/update/archive`. Uma UI mais restritiva não substitui a autorização do Core Host. A verificação real por papel e tenant continua pendente.

## Novos endpoints e mudanças retrocompatíveis

- `GET /v1/tenants/:tenantId/crm/capabilities`: mapa `people.read/write`, `organizations.read/write`, `relationships.write`, `tags.read/write`, `notes.read/write`, `employees.read/write`, `channels.read/write`. O Core Kernel consulta membership e OpenFGA por capacidade; problemas de serviço falham fechados. Não seleciona banco para decidir capacidades.
- `GET /crm/people?limit=25&offset=25&q=...` e `/organizations`: offset validado (0–100.000) e SQL parametrizado com `tenant_id`, `ORDER BY` estável.
- `GET /crm/tags`: catálogo de tags do tenant com `crm:tags/read`, limitado a 100.
- `DELETE /crm/people/:id/tags/:tagId` e `/organizations/:organizationId`: desvinculação sob FGA e auditoria atômica na mesma instrução SQL.
- `GET /crm/people/:id/employee`: consulta pontual, escopada ao tenant e à pessoa, em vez de ler os primeiros 100 funcionários.

Não há migração SQL nem nova tabela. Todas as rotas continuam sob `/v1/tenants/:tenantId/crm` e requerem JWT válido no Core Host.

## Verificações concluídas em laboratório

- Build React/TypeScript e Core CRM TypeScript: aprovados.
- Core CRM: testes de domínio/autorização, incluindo capacidade permitida/negada, falha OpenFGA e negação antes de adquirir banco.
- PostgreSQL descartável: migrações repetíveis, relações, atualização, arquivamento, desvinculação com auditoria, paginação e isolamento; testes completos em bancos de tenant fisicamente separados.
- Browser Chrome com **API e identidade simuladas**: edição, vínculos/remoção, notas, tags, canal, funcionário, arquivamento, criação, CSV, mobile e interface restrita.
- Nenhum segredo, token real ou gravação nos bancos existentes foi necessário para os testes.

## Pendências do Product Gate e implantação

1. Executar a nova experiência com login real de **mais de um usuário Keycloak**, privilégios distintos OpenFGA e tenants separados. Confirmar visibilidade das ações e resposta 403 em tentativas HTTP diretas sem privilégios.
2. Atualizar o Core Host e o bundle frontend de desenvolvimento apenas com acesso de operador autorizado, após CI verde e snapshot do artefato anterior. Não usar Docker como contorno de permissões.
3. Verificar sob o Chrome real: criação, edição, notas, vínculos, CSV e arquivamento no tenant demo, sem confundir dados da demo com dados reais de clientes.
4. Concluir revisão de usabilidade/acessibilidade (teclado, leitor de tela), verificar concorrência de edição e testar paginação com datasets amplos.
5. Verificar backups/restore, observabilidade e políticas de implantação antes de produção; não considerar o CI isolado como homologação de cliente.

**Estado formal:** Core CRM segue **em desenvolvimento até o Product Gate**, apesar de as tarefas de frontend acordadas estarem implementadas. Inbox também continua em desenvolvimento. Não iniciar novas stacks Komodo nesta fase.


## Ajuste visual de CRM (2026-11-02) — revisão após screenshots

A pedido do responsável pelo produto, a interface da ficha CRM foi refinada sem mudança de domínio/API:

- **Desktop:** ficha lateral com largura máxima de 860px, responsiva a 94% da viewport em tablets, conteúdo em até duas colunas. Mantém dados e controles visíveis sem sobrecarregar uma coluna estreita.
- **Mobile:** a ficha passa a ocupar 100% da largura da tela; os campos de organização, tags e funcionário tornam-se empilhados em dispositivos estreitos para eliminar truncamento.
- **Cabeçalho de rolagem:** título e botão \`Fechar ficha\` permanecem juntos no topo. O botão foi movido para dentro do cabeçalho, corrigindo uma colisão de camadas encontrada em teste de navegador.
- **Busca mobile:** campo de busca usa toda a linha disponível e botões podem fluir para uma segunda linha.
- O override CSS tem classe própria \`crm-record-sheet\`, preservando a largura dos painéis do módulo Inbox.
- **Testes com Chrome e dados mockados:** painel de desktop medido em 860px numa janela de 1440px; painel mobile medido em **390px numa viewport de 390px** e checado também em 320px, sem overflow, campos cortados ou perda do botão de fechar. Foram repetidos fluxo CRM, regressão da Inbox, UI anônima e 17 testes unitários do Workspace.
- Capturas novas: \`docs/reviews/crm-frontend-2026-11-02/\`. As imagens vêm do frontend real compilado, mas **com API e identidade fictícias**, não de um tenant publicado.

**Product Gate ainda aberto:** a alteração é de experiência de uso. Não comprova homologação Keycloak/OpenFGA real, nem implantação no servidor protegido, e não implica CRM concluído para produção.
