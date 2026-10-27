# PRD-001 — Core CRM Product Spec

## Estado e controle

- Classificação: `MVP`.
- Módulo corrente: Core CRM.
- Estado: spec executável; contratos de identidade, sessão, tenant e autorização estão registrados em CRM-00; Gate 0 aguarda prova PostgreSQL 16 de CRM-01.
- Fonte de escopo: `modules/core-crm/AGENTS.md`, `docs/product/MVP-SCOPE.md` e `docs/engineering/PRD-001-CORE-CRM-TECH-HANDOFF.md`.
- Stack escolhida: NestJS, Next.js App Router, Drizzle ORM e PostgreSQL.
- Dados: banco Control Plane separado; cada tenant possui database PostgreSQL próprio.
- Identidade: Keycloak OIDC, com MFA e SSO interno do realm; protocolo/session/claims e autorização estão congelados no handoff CRM-00.

## Problema e objetivo

Entregar um CRM básico e seguro, fonte canônica para pessoas e organizações, utilizável por uma pequena empresa. O sistema deve permitir cadastrar e relacionar organizações e pessoas, registrar interações essenciais e encontrar/exportar dados autorizados. A fronteira do tenant deve ser aplicada pelo backend em todas as operações.

## Usuários e limites de identidade

- Usuários autenticados do tenant usam a mesma aplicação Core CRM; os registros acessíveis dependem do papel e customer scope do membership no Control Plane.
- Platform Admin usa o manager separado para metadados e estado de provisionamento do tenant; esse papel não concede acesso automático ao conteúdo do CRM.
- Keycloak autentica a identidade; o Control Plane continua sendo a fonte de verdade para tenants, memberships e permissões do produto. Não duplicar a registry de tenants em organizações/roles do IdP.
- `platform_admin` accesses manager routes only; it has no automatic CRM access. `tenant_admin` can perform all approved CRM operations, including archive/export. `tenant_member` may read/create/update but cannot archive or export.
- MFA is mandatory for Platform Admin; tenant-member MFA follows the operator-configurable Keycloak realm policy. Keycloak realm SSO is in MVP; per-tenant external SAML/OIDC federation is post-MVP.
- `Person`, `Employee` e `UserAccount` são conceitos distintos. Employee representa um perfil de funcionário/atendente do tenant e pode ser vinculado a uma conta, sem conter identidade ou credenciais de login.
- `tenant_admin` pode configurar o escopo fixo de cada `tenant_member`: `cpf`, `pj` ou `both`. `cpf` vê Persons clientes sem vínculo PJ; `pj` vê Organizations PJ e as Persons de contato vinculadas; `both` vê ambos. O backend aplica o escopo em CRUD, relações, busca, timeline e import/export. Não criar políticas ou papéis customizáveis.
- O contrato de sessão, claims, autorização e subject→ator está congelado em CRM-00; nenhum endpoint tenant-facing ou manager pode ser exposto antes do Gate 0.

## Capacidades incluídas

### Core CRM

1. Criar, consultar, editar e arquivar organizações e pessoas.
2. Relacionar pessoa e organização sem duplicar a fonte canônica.
3. Manter tags e associações de tags com os registros aprovados.
4. Registrar notas e uma timeline cronológica das atividades suportadas.
5. Guardar identidades/metadados de canais vinculados a uma pessoa. Metadados externos podem preencher cadastro novo, mas não podem sobrescrever silenciosamente nome CRM confirmado.
6. Buscar por nome, empresa, telefone, email, CNPJ e tags.
7. Normalizar contatos de forma determinística e alertar sobre possíveis duplicatas; não mesclar automaticamente.
8. Importar/exportar CSV com validação, limites definidos no contrato técnico, erros legíveis e autorização por registro/operação.

### Platform Core mínimo consumidor

- Registro Control Plane com ID permanente, metadados aprovados, referência não secreta para database e estado de provisionamento.
- Provisionamento de tenant idempotente, seguro para retry e com estado de falha observável.
- Resolver actor e tenant no servidor e rotear conexões ao database correspondente com isolamento.
- Autorização least-privilege e auditoria das operações críticas.
- Manager para listar/ver metadados, criar tenant, iniciar/repetir provisionamento e editar metadados aprovados.
- Manager nunca lista, pesquisa, exporta ou altera registros de CRM.

## Regras de negócio e segurança

- O CRM é a source of truth para pessoas e organizações.
- Seleção de tenant/database nunca vem de parâmetro controlado pelo cliente; resolve-se por identidade autenticada e registro confiável do Control Plane.
- Nenhuma operação aceita acesso a registro de outro tenant. Negar ou responder not found conforme o contrato de API.
- Operações de leitura, escrita, importação e exportação executam autorização backend.
- Arquivamento é o fluxo normal; não há hard delete na UI do CRM.
- Mudanças relevantes geram auditoria sem tokens, credenciais ou dados financeiros sensíveis nos logs.
- CSV valida encoding/estrutura/tamanho/quantidade, neutraliza conteúdo perigoso na exportação e reporta linhas inválidas sem mutações parciais não documentadas.
- Estado e nomes de canal permanecem separados dos campos confirmados do CRM.

## Jornadas de aceite

### CRM

Login → Organization → Person → Relationship → Tags → Note → Search → Timeline → Archive → CSV export.

### Isolamento

Com Tenant A e Tenant B provisionados, o usuário de B não lê nem altera registros, relações, notas, identidades, importações ou exportações de A, inclusive ao manipular IDs.

### Manager

Platform Admin cria um tenant, observa e repete provisionamento com segurança, edita metadados permitidos e confirma estado. A API/UI do manager não apresenta conteúdo CRM.

## Requisitos não funcionais

- Modular monolith; módulos NestJS `platform-core` e `core-crm`; UI Next.js separada em `platform-admin` e `core-crm`.
- Migrations revisadas e aplicadas por etapa de release, não no startup da API; aplicáveis a PostgreSQL descartável.
- Pools/conexões limitados e observáveis, com limites definidos por medição.
- Erros previsíveis, logs sem secrets e auditoria nas operações críticas.
- Build/lint/typecheck/unit/integration apropriados verdes para cada mudança.
- Cada componente recebe testes relevantes na mesma fatia.
- E2E de frontend é opt-in e de alto custo: apontar para o gate; quando explicitamente executado, usar script Playwright headless, analisar logs/resultados e não dirigir manualmente o frontend.

## Critérios de aceite do módulo

- Todos os requisitos incluídos acima estão integrados à jornada demonstrável.
- Platform Core aplica auth, autorização e resolução server-side de tenant; provisioning é idempotente.
- Testes de integração provam migrations, autorização e isolamento A/B, incluindo tentativas por ID adulterado.
- Testes cobrem CRUD, relações, busca, normalização, duplicidade, tags, notas, timeline, archive, channel identities, CSV e auditoria.
- UI consome APIs NestJS; Platform Admin não recebe acesso automático ao conteúdo CRM.
- CI configurado está verde; logs/resultados e estado do banco são registrados. E2E Playwright é reportado como não executado até a decisão de executar o gate.
- Revisão de segurança e demonstração da jornada aprovadas.

## Fora de escopo

Pipeline, deals, lead scoring, forecasting, propostas/orçamentos, marketing automation, custom fields avançados, IA no domínio, merge automático, hard delete, billing, gestão de assinaturas, suspension policy, SAML/SCIM/federação, plugin marketplace e módulos posteriores.

## Bloqueios restantes do Gate 0

1. Executar e obter CI verde da migration Control Plane em PostgreSQL 16 descartável, desde banco vazio e com reaplicação.
2. Medir o ciclo de conexões/pool e selecionar o secret store conforme o ambiente de implantação antes do primeiro deployment; não bloquear desenvolvimento local sem endpoints.

Decisões não inferíveis devem ser trazidas ao coordenador com alternativas, impacto e recomendação. Enquanto abertas, só tarefas de schema/migration/teste que não exponham endpoints podem avançar.

Referências oficiais da decisão: [Keycloak OIDC e proteção de aplicações](https://www.keycloak.org/securing-apps/overview), [OIDC endpoints/JWKS](https://www.keycloak.org/securing-apps/oidc-layers), [MFA OTP e recovery codes](https://www.keycloak.org/docs/26.8.1/server_admin/), [SSO/identity brokering](https://www.keycloak.org/docs/26.8.1/server_admin/).
