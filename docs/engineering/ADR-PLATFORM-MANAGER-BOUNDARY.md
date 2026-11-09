# ADR — Fronteira Control Plane / Tenant Plane do Syndes Platform Manager

Status: proposto para revisão de engenharia. Data: 2026-11-09.

## Contexto
O Workspace dispõe de CRM, Inbox, WhatsApp e dados privados de tenant. O Platform Manager precisa administrar metadados globais sem tornar-se um superusuário dos dados privados. O isolamento de frontend isoladamente não é controle de segurança.

## Decisão
1. Manter frontends diferentes com builds, imagens e origens HTTPS distintas. O Platform Manager é aplicação interna, não aba do Workspace; sem roteamento por perfil dentro de um único bundle.
2. Keycloak: registrar cliente OIDC público próprio com Authorization Code PKCE S256, redirect URI de origem exata; issuer igual ao realm configurado; audience da API administrativa dedicada; API valida assinatura, issuer, audience, azp e sub. Token do Workspace não autentica no Manager; token do Manager não autentica no Core.
3. API administrativa standalone permite somente GET /me, /summary, /tenants e /tenants/{id}. Sem dependência do Core Host ou providers tenant. Endpoint público /healthz somente para liveness dentro da rede privada.
4. PostgreSQL: conectar somente em syndes_control com role syndes_master_api, NOINHERIT, leitura mínima em tenant_registry, tenant_memberships, platform_operator_access e platform_tenant_profiles; comando DB default read only; privilégio nenhum em bancos de tenant; sem superuser/CREATEDB/CREATEROLE.
5. Rede: API **somente** em `master-private`, `syndes-master-data` (PostgreSQL) e `syndes-master-identity` (Keycloak), duas bridges internas dedicadas também conectadas exclusivamente aos serviços-alvo. Frontend apenas `master-private`. O Core Host, Whatsmeow e OpenFGA nunca compartilham essas bridges. O PostgreSQL é um servidor compartilhado e expõe todos os databases pelo mesmo endpoint: o papel `syndes_master_api` é o limite final obrigatório contra tenant DB; rede por si não separa databases. Testar Compose e alcance IP em runner descartável; homologar ACL reais antes do deploy.
6. Autorização: somente sub imutável com grant state='active' em platform_operator_access. owner, operator, viewer são somente leitura neste MVP. Nenhuma herança de papel por tenant, email, ou perfil Keycloak.
7. Operações mutáveis futuras não reutilizam estes endpoints; exigem autorização por ação, trilha de auditoria, rate limits, idempotência e rollback. Nenhuma impersonação nesta entrega.

## Alternativas recusadas
- Console único com menu condicional: uma falha de autorização cria risco transversal.
- DB usuário syndes_core no Manager: privilégios e destino incorretos.
- Client OIDC compartilhado ou aceitação de token com audiências amplas sem azp obrigatório: risco de confusão de token.
- Consultar dados privados para montar indicadores: ampliação indevida de escopo e exposição.
- Provisionamento via INSERT frontend: sem transação, auditoria e segregação.

## Consequências e obrigações
Mais infraestrutura e configuração Keycloak, mas fronteiras auditáveis. Testes de rede, roles SQL, JWT reais e cross-client são gates de release, não substituídos por testes textuais ou UI. Endpoints somente leitura não garantem isolamento por si; comprovar em PostgreSQL e implantação. Rollback apenas do stack Manager sem tocar aplicações/DB dos tenants.
