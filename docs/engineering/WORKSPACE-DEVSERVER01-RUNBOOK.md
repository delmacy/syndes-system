# Runbook — Workspace no DevServer01 (desenvolvimento)

**Escopo:** operação, smoke, rollback e diagnóstico do Workspace com login **somente pelo Keycloak**. Verificado em 2026-11-01; este runbook não aprova produção. O Komodo e o cadastro de stacks ficam fora deste procedimento.

## Referências e configuração

| Item | Atual |
| --- | --- |
| Repositório de execução | `/srv/syndes-lab/system` |
| Código do frontend | `apps/workspace-web` |
| Branch de entrega | `feat/workspace-shell-v1` — PR #9 **draft** (base `feat/core-inbox-foundation`, PR #8) |
| Workspace Tailnet | `https://delmacy-desktoppc.tayra-delta.ts.net:9443/` |
| Keycloak Tailnet | `https://delmacy-desktoppc.tayra-delta.ts.net:9444/` |
| Workspace interno | `127.0.0.1:18084` (HTTP, container estático) |
| Core Host interno | `127.0.0.1:18083` (HTTP, NestJS) |
| Container Workspace | `syndes-workspace-web-workspace-1` |
| Container Core Host | `core-host-core-host-1` |

Manifests **locais ao servidor, não versionados**:

- `/srv/syndes-lab/workspace.compose.yaml`: serviço de arquivos estáticos, bind mounts, configurações e limites Docker.
- `/srv/syndes-lab/workspace.traefik.yaml`: labels/rotas da entrada exclusiva ao Workspace; possui **apenas** `syndes-tailnet-only@docker` como middleware.
- `/srv/syndes-lab/workspace.nginx.conf`: Nginx interno estático, sem proxy de backend.
- `/srv/syndes-lab/workspace-runtime.json`: configuração pública do OIDC/tenant demo, servida por `alias` em `/workspace-runtime.json`.
- `/srv/syndes-lab/workspace.traefik.yaml.before-single-login`: cópia pré-migração **somente para referência**; **não restaurar cegamente**, pois recoloca dois logins.

**Fonte da verdade:** Git para o código da aplicação; configuração operacional fora do Git até ser migrada para IaC com segregação de segredos. A branch de infraestrutura/Host base `feat/core-inbox-foundation` e a branch do Workspace não estão mescladas.

## Testes seguros — sem alterar dados

Executar no DevServer01:

```bash
cd /srv/syndes-lab/system/apps/workspace-web

npm test                  # testes unitários de HTTP/tenant e callback PKCE
npm run build             # build; substitui arquivos em dist
npm run lint              # verificar avisos
npm run test:ui-anon       # Chrome headless: shell sem sessão, CRM/Inbox protegidos

curl -fsS -o /dev/null -w 'Core Host: %{http_code}\n' \
  http://127.0.0.1:18083/readyz
curl -fsS -o /dev/null -w 'Runtime: %{http_code}\n' \
  http://127.0.0.1:18084/workspace-runtime.json

# HTML público do Workspace: deve ser 200, HTTPS válido, SEM prompt HTTP Basic
curl -sS -o /dev/null -w 'Workspace: %{http_code}; cert=%{ssl_verify_result}\n' \
  https://delmacy-desktoppc.tayra-delta.ts.net:9443/

# API sem Bearer: deve retornar 401 (NÃO 200)
curl -sS -o /dev/null -w 'CRM anônimo: %{http_code}\n' \
  https://delmacy-desktoppc.tayra-delta.ts.net:9443/v1/tenants/4ab44379-d557-4df6-a2be-d44e121a8077/crm/people
```

O teste de navegador autenticado também existe: `npm run test:smoke`. Ele precisa da variável local `SYNDES_PREVIEW_PASSWORD` **somente no processo do teste** (senha da conta demo do Keycloak, nunca commitar ou exibir). Ele usa Chrome, visita o Workspace **sem Basic Auth**, completa Keycloak/PKCE e confere dashboard, CRM, Inbox e logout local. Para rotas de CRUD reais do backend, há scripts de homologação externos à árvore Git em `/srv/syndes-lab/verify-oidc-runtime.py` e `verify-oidc-crud.py`; o **CRUD cria dados de demonstração**, portanto só executar com intenção explícita.

## Procedimento cauteloso de atualização (não automático)

1. Conferir branch, commit aprovado, diff, testes, status do Core Host e imagem/versão Docker. **Não atualizar a partir de PR não revisado em produção.**
2. Fazer backup do `dist` publicado, dos manifests e do runtime público **sem copiar conteúdo de `/srv/syndes-lab/private`**. Não usar `docker compose down -v`.
3. Com `npm ci` em ambiente com acesso ao registro npm, validar build/lint/testes. O DevServer01 já apresentou `EALLOWREMOTE` por política local do npm; **não enfraquecer controle ou alterar lockfile só para contornar isso**.
4. Neste lab, a pasta `dist` é montada diretamente em leitura pelo container. Um build direto pode expor atualização não atômica por segundos; para produção, substituir por artefato imutável e rollout atômico. As mudanças de roteamento exigem validar e recriar **somente** o serviço frontend:

```bash
cd /srv/syndes-lab
docker compose -f workspace.compose.yaml \
  -f workspace.traefik.yaml config --quiet

docker compose -f workspace.compose.yaml \
  -f workspace.traefik.yaml up -d --no-deps workspace
```

5. Executar os checks acima. Se não houver HTTP 200 para `/` ou `/workspace-runtime.json`, verificar logs/labels e montagem; **não** relaxar a checagem JWT.
6. Para rollback, restaurar **somente o build estático previamente aprovado** e os manifests correspondentes, seguindo novo `up -d --no-deps workspace` se necessário. Evitar restauração do middleware Basic Auth anterior.

## Fluxo esperado da autenticação

```text
GET /                         200, sem WWW-Authenticate
GET /workspace-runtime.json   200, application/json sem segredo
botão Entrar                  redireciona para Keycloak (9444)
callback /?code=...           PKCE, state, token em memória
GET /v1/tenants/.../crm/...   401 sem JWT, 200 autorizado; outro tenant 403
GET /v1/tenants/.../inbox/... 401 sem JWT, 200 autorizado
botão Sair                    limpa o token local (não encerra sessão SSO)
```

**Acesso à página estática não significa acesso a dados.** O Core Host é responsável por vinculação do tenant, OpenFGA e acesso a banco. Os usuários não precisam de um segundo login HTTP Basic.

## Diagnóstico sem acesso a segredos

- `404` inicial logo após recrear Workspace: aguardar atualização do Traefik e verificar se routers/middlewares Docker foram descobertos; a confirmação final deve ser estável.
- `401` em `/`: indica que o Basic Auth legado voltou ao roteador Workspace. Verificar labels `syndes-workspace.middlewares`, sem remover a allowlist Tailnet.
- `404` em `/workspace-runtime.json` após `npm run build`: o JSON **não** deve depender de `dist`. Conferir bind mount somente leitura de `/srv/syndes-lab/workspace-runtime.json` em `/etc/nginx/workspace-runtime.json` e `alias` no Nginx.
- `401` após login ou `403` em outro tenant: verificar token/issuer/audience/membership e políticas no Core Host; nunca permitir fallback para token de outro usuário.
- `503` ou /readyz falho: conferir estado de Keycloak, OpenFGA, OpenBao (selado após reboot sem unseal), controle e bancos PostgreSQL; nunca imprimir root token ou shares de recuperação.
- Falha de build do Vite ou testes: não marcar como release aprovada. CI `Syndes Workspace UI CI` é o gate de frontend.
- O status de deploy **Vercel** apareceu como falha independente; não representa a disponibilidade do deployment self-hosted Docker/Traefik. Investigar apenas se Vercel passar a ser alvo oficial.
- A prévia legada `syndes-ui-preview` é outro container e não deve ser usada como evidência de login único.

## Estado final conhecido

Em 2026-11-01: página Workspace `200` e TLS válido sem HTTP Basic, runtime `200`, CRM/Inbox anônimos `401`, bloqueio de acesso à rota via container não autorizado `403`; Keycloak OIDC + PKCE e páginas CRM/Inbox aprovados em Chrome; 5 testes unitários passando; CI do Workspace concluído com sucesso. Isso **não comprova** prontidão de produção, backups restauráveis, múltiplos tenants reais ou acessibilidade de todos os papéis.

Referências: `docs/engineering/WORKSPACE-SHELL-ARCHITECTURE.md` e `docs/product/WORKSPACE-MVP-HANDOFF.md`.
