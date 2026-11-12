## 7. Frontend — apresentação ao usuário

**Aplicação canônica:** `apps/workspace-web`; arquivos de função `features/crm.tsx` e `features/crm-person-detail.tsx`. A antiga UI servida em `/crm` é legado de desenvolvimento, não o destino definitivo do produto.

### Telas e interações previstas pelo MVP

1. Listagem pesquisável de pessoas e organizações; paginação.
2. Cadastro e edição de Person/Organization, com validação de campos.
3. Ficha detalhada de pessoa: organizações, tags, notas, canais, perfil de funcionário, timeline.
4. Criação e remoção de vínculos com confirmação adequada; archive seguro.
5. Alertas de possíveis duplicidades; revisão manual, sem merge automático.
6. Importar/exportar CSV quando autorizado.
7. Mensagens de sucesso, carregamento, erro, vazio e acesso negado.
8. Interações responsivas e navegação por teclado; componentes visuais compartilhados quando aplicável.

**Regra de apresentação:** jamais inventar menus, botões, telas de review WA ou ações que não tenham requisito aprovado. Exibir ações conforme capabilities efetivas, mantendo backend como fonte de autorização. O estado `unauthorized` difere de `unavailable`.

### Evidências atuais e faltantes

A documentação existente descreve UI construída e testes de navegador com API/identidade mockadas, incluindo correções responsivas. **Não demonstra** homologação de dois usuários Keycloak reais, FGA real e tenant A/B com fluxo completo. Esse aceite pertence ao STATUS e aos gates da entrega.

---
