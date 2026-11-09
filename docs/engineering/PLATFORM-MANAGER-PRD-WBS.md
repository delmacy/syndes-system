# Syndes Platform Manager — PRD, WBS e contrato de interface

Status: MVP em desenvolvimento; não homologado nem implantado. Data: 2026-11-09.
Branch local auditada: feat/platform-master-admin-console-20261109. Base de código: 8e2fb5d.
Produto: aplicação interna do Control Plane, independente do Workspace de tenants.

## 1. Objetivo e fronteira

Oferecer a owner/operator/viewer uma visão autorizada e somente leitura do cadastro comercial, estados e vínculos ativos dos tenants. Nenhuma leitura de CRM, Inbox, WhatsApp ou banco privado. A separação não se baseia no menu: exige frontend, build, origem, cliente OIDC, API, credenciais PostgreSQL e regras de rede separados; tokens cruzados são recusados.

## 2. Requisitos do MVP (contratos)

- PM-AUTH-01: login Keycloak Authorization Code + PKCE S256 com client OIDC próprio; estado com expiração, nenhum token persistente; logout local.
- PM-AUTH-02: API valida assinatura JWT RS256, issuer, audience, azp e sub; grant ativo por sub imutável em platform_operator_access; sem concessão via vínculo tenant.
- PM-SEC-01: API somente GET nas rotas documentadas; nenhum CRM, Inbox, WhatsApp, impersonação ou escrita.
- PM-SEC-02: rol PostgreSQL específico somente leitura no syndes_control; nenhuma conexão tenant; rede API sem rota para Core Host nem bancos privados.
- PM-UI-01: login e negação explícita; carregando, erro, vazio e resposta da API verificados.
- PM-UI-02: visão geral com clientes registrados, tenants ativos, provisionados, suspensos, vínculos ativos e clientes recentes; fonte real Control DB.
- PM-UI-03: diretório paginado de clientes com busca por nome/UUID, filtro de estado, estado, data e membros ativos.
- PM-UI-04: detalhes administrativos consultados pela rota de detalhe, sem conteúdo privado.
- PM-OPS-01: Docker/Compose independentes, configuração sem segredos em Git, healthcheck, acesso HTTPS privado preferencial, reversão e smoke test antes de release.
- PM-QA-01: contratos de API, testes negativos (OIDC, tenant-cross, DB, HTTP), unitário/frontend, regressão CRM/Inbox/WhatsApp/Core Host, E2E e CI verde.

## 3. Inventário dos endpoints aprovados

| Rota | Método | Resposta | Requer |
| --- | --- | --- | --- |
| /healthz | GET | {status:ok} | Rede interna, liveness sem informação sensível |
| /v1/platform/admin/me | GET | role, capabilities | JWT correto + platform_operator_access ativo |
| /v1/platform/admin/summary | GET | total, active, provisioned, suspended, memberships | Mesma autorização |
| /v1/platform/admin/tenants?query=&state=all&page=1 | GET | total, page, pageSize=25, items | Mesma autorização; SQL parametrizado |
| /v1/platform/admin/tenants/{UUID} | GET | id, displayName, status, createdAt, activeMembers | Mesma autorização; UUID válido |

Paginação estável por created_at DESC e tenant_id ASC. Nome comercial pode ser nulo. Métrica memberships é quantidade de vínculos ativos, não pessoas únicas. Clientes recentes são obtidos com pesquisa vazia/state=all/page=1, independentemente do filtro do diretório.

## 4. Matriz de permissões

| Perfil | Visão geral | Diretório | Detalhes | Modificar tenant | Dados privados |
| --- | --- | --- | --- | --- | --- |
| owner | Sim | Sim | Sim | Não (MVP) | Não |
| operator | Sim | Sim | Sim | Não (MVP) | Não |
| viewer | Sim | Sim | Sim | Não | Não |
| tenant admin sem grant | Não | Não | Não | Não | Não |
| token inválido, Workspace azp ou sem audiência Master | Não | Não | Não | Não | Não |

Acesso negado é 401 para identidade inválida e 403 para principal sem grant; falha do Control DB retorna 503 sem revelar esquema/credenciais. Segurança não depende de Origin ou CORS, apenas complementados por ambos.

## 5. Contrato rastreável de frontend

| Elemento | ID | WBS | Fonte / API | Permissão | Estados / teste |
| --- | --- | --- | --- | --- | --- |
| Login | PM-UI-01 | 5.1 | Keycloak PKCE | Anônima | carregando, falha, sucesso; teste PKCE |
| Resumo: 4 estados + vínculos | PM-UI-02 | 5.2 | GET /summary | viewer+ | carregando, vazio, erro; contract test |
| Clientes recentes | PM-UI-02 | 5.3 | GET /tenants (all/page1) | viewer+ | vazio, erro; independência de filtros |
| Diretório | PM-UI-03 | 5.4 | GET /tenants | viewer+ | filtro, paginação, vazio, erro |
| Detalhes | PM-UI-04 | 5.5 | GET /tenants/{UUID} | viewer+ | carregando, erro, 404, sucesso |
| Logout local | PM-AUTH-01 | 5.1 | Sessão de memória | Autenticada | sem reutilizar token |
| Navegação | PM-UI-01 | 5.6 | somente visão geral e clientes | viewer+ | menu sem futuras funções |

Não criar páginas para Operações, Governança, Assinaturas, módulos, cobrança, observabilidade, nem gráficos fictícios. UI deve exibir 'Syndes Platform Manager', sem rótulos de produto 'Master Admin'. Diretório e detalhes não são atalhos para o ambiente do cliente.

## 6. WBS com gates

- 1.0 Auditoria: 1.1 verificar branch/diff sem sobrescrever; 1.2 inventariar módulos; 1.3 baseline; 1.4 registrar riscos. Gate: baseline e alterações locais preservadas.
- 2.0 Contratos: 2.1 este PRD; 2.2 ADR Control/Tenant Plane; 2.3 matriz de permissões; 2.4 inventário de APIs; 2.5 critérios de aceite. Gate: escopo aprovado.
- 3.0 Identidade e isolamento: 3.1 cliente OIDC próprio; 3.2 JWT iss/aud/azp/sub; 3.3 grant por sub; 3.4 role SQL; 3.5 negar token cruzado; 3.6 teste PostgreSQL/Keycloak. Gate: todos os casos negativos.
- 4.0 API somente leitura: 4.1 /me; 4.2 /summary; 4.3 listagem/filtro; 4.4 detalhes; 4.5 erros; 4.6 limites de query. Gate: testes de rota/contrato e conexão DB.
- 5.0 UI: 5.1 login; 5.2 resumo; 5.3 recentes; 5.4 diretório; 5.5 detalhes; 5.6 navegação mínima; 5.7 estados acessíveis. Gate: build e testes de frontend.
- 6.0 Qualidade: 6.1 unitários; 6.2 integrações PG; 6.3 JWT adversarial; 6.4 token cruzado; 6.5 regressão CRM/Inbox/WhatsApp; 6.6 navegador E2E; 6.7 CI. Gate: suites antigas e novas verdes.
- 7.0 Release separado: 7.1 duas imagens; 7.2 Compose/redes; 7.3 segredos OpenBao; 7.4 HTTPS privado; 7.5 healthcheck; 7.6 rollback e smoke real. Gate: homologação assinada; não realizar deploy automático.
- 8.0 Evolução BLOQUEADA: provisionamento, suspensão, módulos, operadores, métricas de Support, cobrança/contratos/relatórios. Exige novo PRD/WBS/permissionamento/auditoria/testes.

## 7. Aceite, evidências e pendências

Aceito como implementado somente quando houver: código e testes; API real lendo Control DB com usuário mínimo; Keycloak configurado com azp e audience; recusa de tokens cruzados; PostgreSQL real descartável; testes de UI/navegador; CI sem regressões; deploy HTTPS separado e smoke real. Build local ou captura de mock NÃO equivale a operacional.

Baseline inicial 2026-11-09: master API 3/3; Core Host 23/23; frontend build aprovado mas npm test executava 0 testes. Necessário complementar testes. A branch tinha alterações não commitadas no win1-server e não estava publicada no GitHub. DevServer01 tem mudanças não commitadas independentes e não deve ser alterado neste trabalho.

## 8. Registro obrigatório por tarefa

Para cada item WBS: objetivo, arquivos, dependências, novos testes, resultado, evidência, commit/PR, estado. Logs de CI e e2e devem acompanhar a revisão. Nunca suprimir testes anteriores, remover trava SQL 002, fazer migração de tenant real ou merge automático.
