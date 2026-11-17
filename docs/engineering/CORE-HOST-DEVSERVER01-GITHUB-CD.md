# Syndes Core Host → DevServer01 via GitHub Actions

**Estado em 17/11/2026: comunicação e Compose homologados apenas em modo leitura; deploy DESATIVADO. Backups reais e restore operacional NÃO comprovados.** A autenticação OIDC, conexão à Tailnet e SSH de leitura foram comprovados pelo [GitHub Actions, run 44129310863, tentativa 4](https://github.com/delmacy/syndes-system/actions/runs/44129310863). Isso não comprova uma publicação nem um rollback real.

## Política de publicação

O único mecanismo autorizado para ativar o Core Host no DevServer01 é `.github/workflows/syndes-core-host-devserver01.yml`. O workflow escuta `workflow_run` de `Syndes Mainline CI` concluído com sucesso, originado de push em `main` do próprio repositório. Confere que o SHA de origem ainda é a ponta atual do `main`; não promove PR, fork ou commit obsoleto. Exige TRÊS condições simultâneas em **variáveis de repositório**: `SYNDES_DEV_CORE_HOST_CD_ENABLED=true`, `SYNDES_DEV_CORE_HOST_RELEASE_APPROVED_SHA=<SHA exato do commit de main>` e `SYNDES_DEV_CORE_HOST_RECOVERY_APPROVED=true`. O terceiro campo é uma declaração **manual de aprovação**, não uma prova técnica de backup: só configurar depois de evidência real de restore recuperável, sob custódia e aprovação do operador. As três condições protegem contra deploy de todo novo push indiscriminadamente. Caso qualquer condição falte, executa somente o preflight de leitura. **Mantenha o switch ausente ou false enquanto a recuperação operacional não estiver homologada.**

## Exceção pontual aprovada para protótipo (17/11/2026)

O proprietário autorizou explicitamente realizar **o primeiro deploy do Core Host em DevServer01 sem exigir restore operacional dos dados**, por este ser um ambiente de prototipação. Essa decisão aceita o risco de perda de dados do protótipo em caso de falha, e **não** equivale a ter backup/restore comprovado.

A exceção é ativada **somente** pelo commit de `main` cujo assunto exato seja:

`ci(cd): prototype DevServer01 Core Host release 2026-11-17`

O workflow consulta o assunto do commit da execução `workflow_run` e confirma novamente com `git log -1 --format=%s` antes do build. Permanecem obrigatórios CI da `main` verde, repositório e branch corretos, SHA atual, Tailscale OIDC, os quatro hashes do Compose, identidade remota, imagem de rollback e capacidade de disco. O serviço alvo continua exclusivamente `core-host-whatsapp`. O pipeline não executa migrações SQL, DDL, backfill nem alterações de outros contêineres.

**Não declarar `SYNDES_DEV_CORE_HOST_RECOVERY_APPROVED=true`:** essa variável continua representando atestação de recuperação real, que ainda não ocorreu. A exceção de protótipo é separada e deve ser eliminada do workflow após a execução para não se tornar via permanente de deploy.

Uma liberação de Core Host sem migrações pode, mesmo assim, encontrar incompatibilidade com o banco e exigir rollback de contêiner. Restaurar a imagem anterior **não recupera dados perdidos ou alterados**.

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
