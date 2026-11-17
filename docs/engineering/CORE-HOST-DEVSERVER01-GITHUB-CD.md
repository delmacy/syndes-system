# Syndes Core Host → DevServer01 via GitHub Actions

**Estado em 17/11/2026: primeiro deploy de protótipo EXECUTADO COM SUCESSO pelo GitHub Actions; exceção de release consumida e removida.** Imagem implantada: `syndes/core-host:git-41bfc3cd8b4c52f23fbfe20414b4ee664000fb1f`. Evidência: [GitHub Actions run 44144966110](https://github.com/delmacy/syndes-system/actions/runs/44144966110), com `CUTOVER_VERIFIED`. Readiness HTTP 200, Inbox anônimo HTTP 401, flags de runtime e contêineres dos demais serviços preservados. O rollback **não foi acionado** e portanto não foi ensaiado em ambiente real. O backup/restore operacional **não foi homologado**.

## Política de publicação

O único mecanismo autorizado para ativar o Core Host no DevServer01 é `.github/workflows/syndes-core-host-devserver01.yml`. O workflow escuta `workflow_run` de `Syndes Mainline CI` concluído com sucesso, originado de push em `main` do próprio repositório. Confere que o SHA de origem ainda é a ponta atual do `main`; não promove PR, fork ou commit obsoleto. Exige TRÊS condições simultâneas em **variáveis de repositório**: `SYNDES_DEV_CORE_HOST_CD_ENABLED=true`, `SYNDES_DEV_CORE_HOST_RELEASE_APPROVED_SHA=<SHA exato do commit de main>` e `SYNDES_DEV_CORE_HOST_RECOVERY_APPROVED=true`. O terceiro campo é uma declaração **manual de aprovação**, não uma prova técnica de backup: só configurar depois de evidência real de restore recuperável, sob custódia e aprovação do operador. As três condições protegem contra deploy de todo novo push indiscriminadamente. Caso qualquer condição falte, executa somente o preflight de leitura. **Mantenha o switch ausente ou false enquanto a recuperação operacional não estiver homologada.**

## Histórico do primeiro release de protótipo (17/11/2026)

O proprietário autorizou expressamente publicar no ambiente de prototipação **sem exigir o backup/restore operacional**. O risco foi aceito para essa única implantação; não foi atribuído o valor falso `SYNDES_DEV_CORE_HOST_RECOVERY_APPROVED=true`.

A PR [#154](https://github.com/delmacy/syndes-system/pull/154) introduziu uma exceção de curta duração, ligada ao assunto exato do commit de `main` `ci(cd): prototype DevServer01 Core Host release 2026-11-17`, SHA `41bfc3cd8b4c52f23fbfe20414b4ee664000fb1f`. A [Mainline CI run 44144367475](https://github.com/delmacy/syndes-system/actions/runs/44144367475) passou, e a [execução de CD 44144966110](https://github.com/delmacy/syndes-system/actions/runs/44144966110) confirmou:

- `DEVSERVER01_PROTOTYPE_RELEASE_OWNER_AUTHORIZED`;
- validação dos quatro manifests Compose e da imagem de rollback antes do build;
- carregamento da imagem `syndes/core-host:git-41bfc3cd8b4c52f23fbfe20414b4ee664000fb1f`;
- `CUTOVER_VERIFIED` após `/readyz` HTTP 200 e negação anônima Inbox HTTP 401;
- valores de `WHATSAPP_DISPATCH_ENABLED` e `SYNDES_MULTI_ORG_ENABLED` preservados;
- nenhuma alteração dos IDs de contêineres de outros serviços do mesmo projeto Compose.

**Rebloqueio:** a exceção consumida foi removida na atualização posterior do workflow. As três condições normais de aprovação por SHA, switch de repositório e recuperação operacional voltaram a ser exigidas para futuras implantações. O commit de rebloqueio não modifica o servidor e deve executar apenas o preflight.

**Limite:** o smoke não substitui teste autenticado com Keycloak nem valida grants OpenFGA em operação. O Product Gate permanece OPEN. O rollback da imagem anterior não restaura bancos de dados alterados.

## Homologação operacional de identidade — verificação não mutante

Depois do primeiro deploy, o preflight do GitHub Actions executa `scripts/ci/devserver01-core-host-auth-readonly.sh` no DevServer01 por Tailscale SSH. Usa **apenas** `docker ps`, `docker inspect` e `docker exec` com Node para fazer consultas de leitura **dentro do contêiner Core Host em execução**. Não imprime variáveis de ambiente, JWTs, segredos, membership nem dados de negócio, não cria usuários ou grants e não altera outros serviços.

O script identifica o serviço por `com.docker.compose.project=syndes-whatsapp-cutover` + `com.docker.compose.service=core-host-whatsapp`, exige imagem `syndes/core-host:git-<SHA40>` e confere:

1. `/healthz` e `/readyz` HTTP 200.
2. Configurações OIDC de `/modules/inbox/config` e `/modules/crm/config`, incluindo issuer e client IDs previstos.
3. Acesso do contêiner às chaves públicas RSA do JWKS do Keycloak operacional, sem registrar o corpo.
4. `/healthz` do OpenFGA, com status `SERVING`.
5. HTTP 401 para `/authorize`, CRM e Inbox sem autenticação ou com um Bearer deliberadamente inválido.

**Classificação:** essas verificações são pré-requisitos de infraestrutura e **testes negativos de autenticação**. A marca `DEVSERVER01_IDENTITY_READONLY_PROBE_PASS` **NÃO** significa que um JWT assinado de usuário autorizado passou nem que um grant OpenFGA foi efetivamente avaliado.

### Para concluir o Product Gate com identidade real

É necessária uma identidade de teste operacional explicitamente aprovada, obtida pelo fluxo normal Keycloak Authorization Code + PKCE, com `sub` imutável identificado fora dos logs. Deve ser provisionado um tenant de teste ativo e um `tenant_memberships` ativo para essa identidade. Um administrador autorizado deve conceder **somente** o recurso aprovado no OpenFGA existente, sem grant geral, e registrar evidências de revogação. Nenhum desses dados, senhas ou tokens deve ser colado em issues, Actions ou respostas do agente.

Matriz de aceitação pendente: token real válido + membership + `can_read` → autorização permitida; token real sem membership → negado; outro tenant → negado; token `syndes-master-admin` → 401; permissão de escrita ausente → negado; após revogação da tuple → negado. Para cada caso registrar somente categoria de teste e status, **não** JWT, `sub`, tenant ID, dados CRM ou FGA tuple.

A implementação de testes positivos contra Keycloak/PostgreSQL/OpenFGA descartáveis no CI não substitui essa prova no DevServer01 com identidade operacional real. Nenhuma migração, inscrição de novo tenant, cliente OIDC ou grant operacional é autorizada pelo preflight de leitura.

## Conectividade e variáveis

A conexão de deploy é GitHub Actions → OIDC Tailscale → `tag:syndes-ci` → Tailscale SSH → `tag:syndes-devserver01`. A autenticação SSH e identidade do host são verificadas pelo Tailscale. Não requer segredo de chave SSH, known_hosts, Client Secret OAuth ou credencial de registry. A regra Tailscale SSH para o CI precisa permitir usuário Linux `delmacy`, `accept` sem confirmação interativa, junto a grant TCP 22 de rede. A identidade OIDC observada é `repo:delmacy@26817160/syndes-system@1433806501:environment:devserver01`.

| Escopo | Nome | Configuração |
| --- | --- | --- |
| GitHub Repository Variable | `SYNDES_DEV_CORE_HOST_CD_ENABLED` | **false ou ausente** até autorização explícita |
| GitHub Repository Variable | `SYNDES_DEV_CORE_HOST_RELEASE_APPROVED_SHA` | SHA completo de 40 caracteres da `main` especificamente aprovado; não manter aprovação para próximas alterações |
| GitHub Repository Variable | `SYNDES_DEV_CORE_HOST_RECOVERY_APPROVED` | **false ou ausente** até backup operacional verificado por restauração e autorização formal; `true` é atestação humana |
| Environment `devserver01` Variable | `SYNDES_DEV_TAILSCALE_TAG` | `tag:syndes-ci` |
| Environment `devserver01` Variable | `SYNDES_DEV_SSH_HOST` | `delmacy-desktoppc.tayra-delta.ts.net` |
| Environment `devserver01` Secret | `SYNDES_TAILSCALE_OAUTH_CLIENT_ID` | OIDC Client ID (nome legado) |
| Environment `devserver01` Secret | `SYNDES_TAILSCALE_OIDC_AUDIENCE` | OIDC Audience |

As variáveis legadas de Compose (`SYNDES_DEV_CORE_HOST_COMPOSE_*`), porta, usuário e os segredos `SYNDES_DEV_SSH_KEY` e `SYNDES_DEV_SSH_KNOWN_HOSTS` **não são consumidos pelo CD atualizado**. Não excluir os segredos sem verificar outros consumidores.

## Contrato Compose real, bloqueado por SHA256

O projeto operacional é `syndes-whatsapp-cutover`; o serviço único de deploy é `core-host-whatsapp`. O outro serviço, `workspace-whatsapp`, não pode ser recriado. O diretório principal é `/home/delmacy/syndes-system/modules/whatsapp/deploy`.

O script `scripts/deploy/devserver01-core-host.sh` trava **a ordem e o SHA256** dos quatro arquivos históricos:

| Ordem | Manifesto | SHA256 |
| --- | --- | --- |
| 1 | `/home/delmacy/syndes-system/modules/whatsapp/deploy/devserver01-cutover.compose.yaml` | `b0d1a94dcf00de7129aeb118b027dd161fb6047c22516affa2031b8c53e2220f` |
| 2 | `/home/delmacy/syndes-releases/inbox-receipts-scroll-20261104/core-r2.override.yaml` | `62fae023cfb0db70e64243588b9139cadf1b662f1912c82f059feb861714d6b9` |
| 3 | `/home/delmacy/syndes-releases/org-scope-8e2fb5d-20261109/release-override.compose.yaml` | `b003f8f0fb57d4d2d2df895bf1fcf13bf07b200f5fdc7f0eae7dfa1ab35b0e9c` |
| 4 | `/home/delmacy/syndes-releases/inbox-assignment-4126665/release-override.compose.yaml` | `abe594ab53d3bd7947a15386f915d005313a13ccd4d0477256cbfb91c6908955` |

Esses manifests usam imagem literal, e **não** `SYNDES_CORE_HOST_IMAGE`. O CD preserva os quatro originais e passa a criar um **quinto arquivo persistente**, gerenciado exclusivamente pelo GitHub Actions:

`/home/delmacy/syndes-system/modules/whatsapp/deploy/.syndes-core-host-cd.override.yaml`

O único conteúdo permitido é:

```yaml
services:
  core-host-whatsapp:
    image: syndes/core-host:git-<SHA40>
```

A ativação utiliza `docker compose --project-name syndes-whatsapp-cutover -f <1> -f <2> -f <3> -f <4> -f <override> up -d --no-deps --force-recreate core-host-whatsapp`. **Após o primeiro deploy, qualquer operação futura de Compose que pretenda manter a imagem de release também deve incluir o quinto arquivo.** Executar manualmente `up` só com os quatro históricos pode trazer de volta uma imagem antiga. O pipeline verifica que um override anterior corresponde exatamente à imagem do contêiner atual e recusa alterações inesperadas.

## Etapas e proteção contra falhas

1. **Preflight somente leitura:** login `delmacy` no `DevServer01`, quatro hashes, serviço e contêiner existente, imagem anterior disponível para rollback, e verificação de que a tag anterior aponta para o mesmo image ID do contêiner. Verifica disponibilidade de escrita no diretório do override e espaço livre (mínimo 2 GiB no Docker data-root e 128 MiB na partição do Compose), sem criar arquivos. Compose válido e multi-org desativado. Nenhum arquivo é criado, nem Docker reiniciado.
2. **Build no GitHub:** reconstruir `syndes/core-host:git-<SHA>` e confirmar SHA no `main`.
3. **Transferência:** `docker save | gzip | tailscale ssh ... 'gzip -dc | docker load'`. Nenhuma imagem é construída no servidor.
4. **Cutover restrito:** quinto override atômico, apenas `core-host-whatsapp`, `--no-deps --force-recreate`. Compara também os IDs dos outros contêineres antes e depois.
5. **Smoke e rollback:** compara image ID efetivo, preserva `WHATSAPP_DISPATCH_ENABLED` e `SYNDES_MULTI_ORG_ENABLED`, verifica `/readyz` HTTP 200 e negação Inbox anônima HTTP 401. Falha tenta restaurar imagem anterior no mesmo override e recriar **somente** Core Host. Logs distinguem `ROLLBACK_CORE_HOST_RESTORED`, `ROLLBACK_UNVERIFIED` e `ROLLBACK_FAILED`.

O preflight é executado automaticamente após CI verde enquanto a chave de deploy estiver desligada. O Product Gate P02 permanece **OPEN** até homologação E2E Keycloak/OpenFGA e validação de backup/restore.

**Antes de ativar o switch:** conferir no GitHub `DEVSERVER01_COMPOSE_READONLY_PREFLIGHT_PASS` após a atualização do preflight, revisar as quatro hashes, confirmar espaço livre, executar backup **real** e restauração isolada dos bancos operacionais aprovados com comparação de integridade (incluindo roles/grants e segredos externos relevantes), documentar responsável, local seguro, janela, escopo, RPO/RTO e procedimento de restauração, e só então aprovar o SHA da release e a atestação `RECOVERY_APPROVED`. Os ensaios de restore existentes em `docs/engineering/ADR-EVENTS-DISPOSABLE-RESTORE-DRILL-20261111.md` são **sintéticos e explicitamente não comprovam** recuperabilidade operacional. Validar compatibilidade do Core Host com schemas e grants atuais; ensaiar rollback controlado em ambiente autorizado. Uma conta operacional mais restrita que `delmacy` continua recomendada. **Não basta configurar uma variável para transformar ausência de backup em recuperação comprovada.**
