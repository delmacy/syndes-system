# Core Host → DevServer01 via GitHub Actions (candidato de CD)

**Estado: deploy DESATIVADO; OIDC e alcance do peer comprovados no GitHub Actions; autorização SSH e Compose ainda não homologados.** Este documento não afirma que houve deploy e não substitui o Product Gate do P02.

## Contrato de entrega

A origem de release é exclusivamente o workflow **Syndes Mainline CI**, acionado por push em main, concluído com SUCCESS. O workflow downstream está em .github/workflows/syndes-core-host-devserver01.yml e não aceita PR, fork nem SHA antigo. O SHA exato do commit em main é reconstruído como imagem Docker syndes/core-host:git-(sha40) com apps/core-host/Dockerfile. Não há execução manual de comandos no DevServer01 por este chat: transferência e ativação somente como job auditável GitHub Actions.

O runner ingressa efemeramente na Tailnet via identidade federada Tailscale OIDC (token de curta duração do GitHub, sem Client Secret) e tag restrita, usa SSH com host key pinada e chave provisionada em Secrets. A imagem trafega em stream criptografado docker save | gzip | ssh | docker load, sem senha de registry no servidor. O script remoto scripts/deploy/devserver01-core-host.sh valida imagem SHA, manifesto Compose por SHA256, serviço existente, preserva dispatch WhatsApp e multi-org, executa apenas compose up -d --no-deps para o serviço aprovado, verifica readiness 200, Inbox anônimo 401 e tenta rollback da imagem anterior quando o smoke falha. Não executa migration, backfill, grant nem atualização do gateway/Workspace.

## Habilitação no GitHub

Criar **GitHub Environment devserver01** com política de branch main, controle de acesso e credenciais mínimas. Até a verificação dos dados abaixo, deixar a variável de REPOSITÓRIO SYNDES_DEV_CORE_HOST_CD_ENABLED ausente ou false (não usar somente Environment Variable, pois a condição job.if é avaliada antes do job entrar no environment). A conexão GitHub disponível nesta sessão não concede acesso a Secrets/Variables e não confirma acesso ao servidor pela Tailnet.

**GitHub Variables** — valores reais fornecidos pelo operador, não inferidos de outros servidores:

| Variable | Exigência |
| --- | --- |
| SYNDES_DEV_CORE_HOST_CD_ENABLED | true apenas depois de todos os pré-gates |
| SYNDES_DEV_TAILSCALE_TAG | Tag limitada ao servidor-alvo, como tag:ci |
| SYNDES_DEV_SSH_HOST | FQDN Tailnet EXATO do DevServer01, terminando em .ts.net |
| SYNDES_DEV_SSH_USER | Usuário SSH não root com acesso Docker |
| SYNDES_DEV_SSH_PORT | Porta SSH numérica, por exemplo 22 |
| SYNDES_DEV_CORE_HOST_COMPOSE_DIR | Diretório real da composição operacional, absoluto |
| SYNDES_DEV_CORE_HOST_COMPOSE_FILE | Arquivo Compose exato relativo ao diretório |
| SYNDES_DEV_CORE_HOST_COMPOSE_PROJECT | Nome Docker Compose existente e aprovado |
| SYNDES_DEV_CORE_HOST_COMPOSE_SERVICE | Nome exato do serviço Core Host |
| SYNDES_DEV_CORE_HOST_COMPOSE_SHA256 | SHA256 verificado do manifesto no servidor |

**GitHub Environment Secrets (`devserver01`)**: `SYNDES_TAILSCALE_OAUTH_CLIENT_ID` (nome legado mantido por compatibilidade, mas deve conter o **Client ID OIDC**, não OAuth); `SYNDES_TAILSCALE_OIDC_AUDIENCE` (Audience da credencial OIDC), `SYNDES_DEV_SSH_KEY`, `SYNDES_DEV_SSH_KNOWN_HOSTS`. **Não cadastrar Client Secret OAuth.** O job solicita `id-token: write` somente para o deploy. Não publicar valores no chat, Issues ou documentação. A chave de host deve vir de canal confiável independente; o workflow não usa ssh-keyscan nem relaxa host key checking. A tag OIDC deve ter ACL Tailnet limitada ao SSH do DevServer01.

O Subject OIDC realmente recebido pelo Tailscale foi `repo:delmacy@26817160/syndes-system@1433806501:environment:devserver01`, corrigido pelo operador;  o Environment `devserver01` precisa existir no GitHub. A credencial também deve autorizar a tag configurada em `SYNDES_DEV_TAILSCALE_TAG`.

## Pré-validação automática de Tailnet (sem deploy)

Enquanto `SYNDES_DEV_CORE_HOST_CD_ENABLED` estiver ausente ou diferente de `true`, o workflow downstream executará somente o job `tailnet-preflight` após um **Syndes Mainline CI** bem-sucedido originado de push na `main`. O job solicita OIDC ao GitHub no Environment `devserver01`, valida que os dois Secrets e a tag têm conteúdo, ingressa efemeramente na Tailnet e confirma endereço IPv4 Tailscale. O preflight também tenta um login Tailscale SSH estritamente de leitura (`id -un` e `hostname -s`) com limite de 25 segundos. Não executa Docker, sudo, transferência de imagem nem altera o DevServer01. Ele continuará rodando após pushes futuros enquanto CD estiver desativado; ao habilitar o CD completo, esse preflight isolado é desativado e o job `deploy` terá sua própria conexão Tailscale.

Um `TAILNET_OIDC_AUTH_VERIFIED` nos logs comprova somente a autenticação e ingresso do runner na Tailnet. Após `DEVSERVER01_TAILSCALE_SSH_READONLY_PASS`, comprova o login SSH não interativo somente para o usuário verificado, mas **não** o acesso Docker, o hash Compose, o rollback nem o deploy. Se falhar, revisar primeiro Client ID, Audience, OIDC subject efetivamente recebido (`repo:delmacy@26817160/syndes-system@1433806501:environment:devserver01`), escopo `auth_keys:write`, tag e configuração do Environment GitHub. Não publicar segredos em logs.

## Inventário operacional e decisão SSH (somente leitura em 17/11/2026)

A inspeção autorizada, somente leitura, encontrou no DevServer01 Tailscale ativo, usuário Linux não-root com acesso a Docker, SSH na porta 22 e `RunSSH=true`. Originalmente o nó usava identidade de usuário; agora foi alterado pelo operador e a inspeção local confirmou a tag **tag:syndes-devserver01**. O runner GitHub entra como **tag:syndes-ci**. De acordo com as restrições atuais do Tailscale, uma identidade tag não pode usar **Tailscale SSH** para acessar uma identidade de usuário. Além disso, quando Tailscale SSH está ativo ele intercepta a porta 22 via rede Tailscale, portanto configurar chaves OpenSSH por si só não resolve o acesso do runner.

**O operador já atribuiu a tag ao DevServer01.** A inspeção somente leitura comprovou Tailscale online, `RunSSH=true`, TCP 22 em escuta, Core Host `running` com zero restarts e DC online. Tailscale ping não comprova permissão SSH. O CD ainda usa SSH tradicional por chave privada e um manifesto Compose, então **não está pronto para executar**. A autorização administrativa humana não foi testada e deve ser preservada; não mudar a política nem o runtime durante o preflight.

O contêiner real do Core Host pertence a um projeto Compose que usa **quatro arquivos combinados**, inclusive overrides históricos. O script CD atual recebe um único manifesto, com um único hash, e uma variável de imagem. Este contrato **não pode ser considerado validado para o serviço real**; antes do deploy será necessário reconciliar o Compose multi-arquivo, fixar os manifests, a imagem e testar rollback. Manter a variável de ativação de CD desativada.

O job não invasivo `tailnet-preflight` também verifica, quando a Environment Variable `SYNDES_DEV_SSH_HOST` estiver preenchida, se o runner alcança o peer pela Tailnet com `tailscale ping`. O resultado `DEVSERVER01_TAILNET_PEER_REACHABLE` **não significa que Tailscale SSH ou a porta TCP 22 foi autorizada**. O hostname do servidor deve permanecer em GitHub Environment Variable, não em código versionado.

## Pré-gates

1. Confirmar no DevServer01 **sem alterar runtime** o Compose real, nome de projeto/serviço, variável SYNDES_CORE_HOST_IMAGE e a imagem anterior syndes/core-host:*. O relatório P02 de 17/11 identificou o serviço syndes-core-host-whatsapp-v2, mas NÃO identifica neste Git o manifesto operacional e seu hash. Não presumir que apps/core-host/compose.yaml corresponde ao Compose em operação.
2. A main deve conter P02-ASSIGN-03 com Mainline CI Gate verde no SHA exato; CI isolada de PR não é release.
3. Validar subject/audience/Client ID OIDC e tag Tailscale, ACL SSH, fingerprint de host, usuário com Docker e recuperação da imagem anterior. O script de rollback não está ensaiado no ambiente real.
4. Realizar primeiro ensaio controlado e verificar que somente o Core Host é recriado e que WHATSAPP_DISPATCH_ENABLED e SYNDES_MULTI_ORG_ENABLED não mudam.
5. Manter Product Gate aberto até E2E com JWT Keycloak, autorização/revogação real do destinatário, tenants A/B, atribuições legadas e backup/restore.

## Estados do Actions

- **Skipped:** switch ausente/desativado. Nenhum deploy.
- **Falha antes de transferir:** credencial, SHA, Tailnet, host key ou build reprovados. Nenhum serviço atualizado.
- **Falha após transferir:** imagem pode permanecer em Docker remoto, mas cutover depende do hash do manifesto e dos preflights.
- **Falha após cutover:** script tenta rollback apenas da imagem anterior do Core Host. Se o rollback falhar, intervenção operacional é necessária.
- **CUTOVER_VERIFIED:** imagem SHA, readiness 200, Inbox anônimo 401 e toggles preservados. Não equivale a identidade autenticada ou Product Gate.

Deploy direto por Desktop Commander, terminal remoto ou atualização manual fica fora do procedimento autorizado neste incremento.
