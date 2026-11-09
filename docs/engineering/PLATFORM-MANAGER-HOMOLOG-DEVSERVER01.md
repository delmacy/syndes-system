# Platform Manager — homologação controlada no DevServer01

**Data:** 2026-11-09. **Branch:** `feat/platform-master-admin-console-20261109`. **Escopo:** ambiente de homologação sem clientes alterados e sem substituir containers operacionais. O estado real deve ser revalidado por comandos de leitura antes de cada avanço. Este registro não autoriza merge ou produção.

## Evidências concluídas

- O checkout de desenvolvimento original do DevServer01 contém mudanças locais de Workspace, e não foi modificado. A homologação usa `$HOME/syndes-platform-manager-homolog`, clone isolado inicialmente no commit `5f54efb`.
- Backup restrito `$HOME/syndes-snapshots/2026-11-09-platform-manager-pre`: `syndes_control.dump` e `syndes_keycloak.dump`, protegidos por modo 0600 e diretório 0700; `SHA256SUMS` aprovado.
- **Restore drill executado** em PostgreSQL 17 descartável sem rede: recuperou 1 registro no tenant registry do Control DB e 101 tabelas da base Keycloak. Este teste não substitui plano de restauração dos serviços compartilhados, mas prova legibilidade dos dumps.
- Migração aditiva `infra/postgres/bootstrap/control-admin.schema` aplicada duas vezes a **syndes_control somente**, com idempotência validada. Foram criadas `platform_operator_access`, `platform_tenant_profiles` e `syndes_master_api`. A role não possui senha, não é superuser, não tem CREATEDB/CREATEROLE e não tem INSERT/UPDATE/DELETE nem CREATE no schema público. Os grants permitem SELECT das quatro tabelas previstas.
- Conexão de `syndes_master_api` aos databases tenant, Keycloak e OpenFGA: negada. O database utilitário `postgres` continua com CONNECT público, pré-existente; nenhuma permissão sistêmica foi revogada para não quebrar outras aplicações. O ambiente real exigirá que a credencial administrativa não conceda acesso a outras bases, com revisão de autenticação/ACL antes do Product Gate.
- Foram criadas as bridges Docker internas `syndes-master-data` e `syndes-master-identity`. PostgreSQL conectado **somente** à primeira; Keycloak conectado **somente** à segunda. Core Host, Workspace, Whatsmeow e OpenFGA não participam das bridges.
- Containers operacionais PostgreSQL, Keycloak, Core Host e Workspace continuaram em execução. Esta vinculação de rede foi feita com `docker network connect`, sem reiniciar containers, e **não persiste após recriações por Compose** na instalação anterior de `/srv/syndes-lab/system`. Não assumir que a stack operacional lê o checkout novo.
- Cliente OIDC `syndes-master-admin` **criado no Keycloak existente** em 2026-11-09, após backup. Redirect HTTPS restrito à origem Tailnet temporária `:9446/`, sem direct password grant, implicit flow ou client secret; PKCE S256 obrigatório. Teste operacional confirmou `unauthorized_client` no fluxo de senha e `invalid_request` quando o desafio PKCE foi omitido. UUID para reversão preservado apenas em `keycloak-master-client.json`, dentro do diretório de backup privado; nenhuma conta de operador foi provisionada.

## Gates restantes

1. **Concluído no Keycloak operacional:** cliente OIDC `syndes-master-admin` e validações negativas de PKCE/direct grant. Script controlado `infra/master-admin/keycloak-homolog.py` lê credenciais por **stdin** e suporta verificação/rollback por UUID privado. Nenhum usuário foi criado ou autorizado.
2. Configurar a origem privada temporária já registrada no cliente como `:9446` através de Tailscale Serve **somente após** containers prontos. Porta HTTPS diferente na mesma máquina é origem distinta, mas ainda compartilha domínio de cookies; exigir identidade de host independente antes de produção. Nenhuma rota Serve foi modificada até este checkpoint.
3. Provisionar credencial de `syndes_master_api` por OpenBao sob AppRole escopada, sem senha em Git/env permanente, e testar apenas a Control DB.
4. Provisionar principal proprietário por `sub` imutável de Keycloak em workflow auditado; não derivar de nome, e-mail ou membership de cliente. Sem grant, nenhum login pode receber metadados.
5. Build API no DevServer01 aprovado. **Build frontend no DevServer01 falhou com SIGILL/exit 132:** CPU sem AVX2, toolchain frontend incompatível localmente. O build do frontend passou no GitHub CI; a entrega correta é um bundle de CI versionado mais Dockerfile.runtime Nginx, nunca reduzir qualidade do compilador para contornar a CPU. Imagem frontend ainda não implantada. **Deploy isolado** depende dos gates anteriores, HTTPS em Tailnet, 401/403, PKCE, papel SQL, rollback e screenshots reais; depois avaliar Product Gate #31.

## Rollback seguro — nunca automático sobre dados compartilhados

- Se Manager subir, parar **somente** `infra/master-admin/compose.yaml` (`docker compose ... down` dessa stack), sem `down -v` dos serviços compartilhados.
- Revogar o client de homologação por UUID gravado pelo provisionador, não por busca arbitrária de nomes (`keycloak-homolog.py --rollback`), e retirar apenas o binding criado para o owner de teste.
- Para reverter as bridges sem reiniciar containers: `docker network disconnect syndes-master-data syndes-postgres-postgres-1`; `docker network disconnect syndes-master-identity syndes-security-access-keycloak-1`; depois `docker network rm syndes-master-data syndes-master-identity`. **Não desconectar as redes originais.**
- O schema SQL é aditivo e pode permanecer sem operadores. Para desabilitar a role, primeiro impedir novas sessões; revogar/invalidar a credencial por procedimento DBA. **Não executar DROP TABLE ou restaurar o banco de dados compartilhado de forma automática**: revisar se há registros novos e coordenar recuperação.
- Backups permanecem no host, sem commit, e só podem ser restaurados conforme janela aprovada; revalidar checksum e dependências antes de um restore operacional.

## Proibições desta etapa

Não tocar em bancos tenant, dados CRM/Inbox/WhatsApp, SQL 002, PR #27, checkout de Workspace do DevServer01 ou rede `syndes-data`/`syndes-security-access` existente. Não alterar serviço Traefik/Tailscale existente nem expor nova rota pública enquanto o acesso ainda não estiver completo e verificado.


## Entrega segura da credencial administrativa pelo OpenBao (pendente de operador)

A role `syndes_master_api` continua **sem senha** e a API permanece **não implantada**. A etapa de provisionamento exige uma ação autenticada e auditada do operador do OpenBao; o projeto não presume acesso ao token root nem obtém credenciais de outros serviços.

- A política em `infra/master-admin/openbao/master-runtime.hcl` concede somente leitura de `kv/data/production/platform-manager` e revogação do próprio token. Criar AppRole exclusivo, com `role-id` e `secret-id` entregues fora do Git em `/run/syndes/approle/platform-manager/`. Nunca utilizar a identidade existente do Core Host.
- O KV v2 deve possuir um campo `master_db_password` gerado aleatoriamente (base64url, 32 a 256 caracteres). Um DBA autorizado deverá configurar **a mesma senha** na role `syndes_master_api`, sem escrevê-la em histórico, argumentos de comandos, logs ou arquivos persistentes. Não mudar roles dos tenants.
- Após disponibilizar a identidade no host operador e o CA TLS de `openbao`, executar `infra/master-admin/openbao/run-renderer.sh` como root autorizado. O wrapper verifica `/run` tmpfs; o renderizador valida TLS, usa AppRole restrita, lê somente o segredo do Manager, revoga token **antes** de publicar credencial e grava `/run/syndes/platform-manager/master_db_url` com owner UID 1000 e modo 0600. O serviço Node opera como UID 1000 e recebe **somente esse arquivo individual** read-only.
- `MASTER_DB_URL_FILE` deve apontar ao segredo renderizado, e o env file do Compose conter apenas issuer, audience, clientId, endereço interno de JWKS, origem HTTPS e `MASTER_CONTROL_DB_URL_FILE=/run/secrets/master_db_url` — nunca a senha. No restart, renovar/validar a entrega de segredo pelo operador. Não iniciar a API com `.env` de senha como atalho.
- A nova rotina possui testes de unidade que verificam DSN fixo em `syndes_control`, rejeição de senha inválida, revogação obrigatória, ausência de arquivo ao falhar revogação e escopo da política. Um teste CI não prova que a AppRole foi provisionada no cofre operacional; esta é uma dependência humana ainda bloqueante.

**Critério de desbloqueio:** AppRole criada e auditada, KV correto, renderização em tmpfs testada, role com senha correspondente, `/readyz` aprovado e principal de operador explicitamente autorizado. Sem isso, a homologação fica no estado **infraestrutura pronta, serviço não ativado**.

## Verificação de execução estática e Product Gate

A imagem Nginx foi criada no DevServer01 a partir do bundle CI `platform-manager-web-dist` (GitHub Actions run `42662879128`). O primeiro teste revelou arquivos de configuração e estáticos em modo 0600 num checkout privado: o usuário Nginx 101 não conseguia lê-los. Os dois Dockerfiles de frontend foram corrigidos para normalizar permissões **somente no build**, voltando ao UID 101 no runtime. O smoke de execução de `homolog-c1ac202` confirmou resposta HTTP 200 para `/` e `/master-runtime.json`, HTTP 404 para `/workspace-runtime.json`, `/readyz`, `/modules/core-crm/config` e `/v1/tenants/...`. Esses contêineres e redes foram descartados, **não há frontend publicado**.

O comando de leitura `bash tests/platform/platform-manager-host-gate.sh` apresenta critérios `PASS`, `BLOCKED` e `WARN`. É deliberadamente não-mutante: usa metadados de Docker e PostgreSQL, não imprime valores de segredos e retorna código 2 quando falta um gate. Deve ser usado antes e depois de qualquer mudança operacional, e sua execução não substitui testes reais de login/401/403.

A imagem Nginx construída com o checkout novo e arquivos da compilação antiga tem proveniência explicitada no manifesto `artifacts/web-dist/CI_ARTIFACT_MANIFEST.json`, ainda **local e fora de commits**; o bundle corresponde ao commit `3cb4f73`, sem mudanças de frontend React desde então. Para release final exigir o bundle CI do HEAD aprovado.

**Bloqueios que não podem ser contornados:** a AppRole e o segredo de acesso ao Control DB precisam ser provisionados por operador autorizado; a role `syndes_master_api` não recebeu senha; a tabela `platform_operator_access` continua sem owner; ainda não há Tailscale Serve 9446 nem API em execução. O banco utilitário `postgres` ainda concede CONNECT via PUBLIC; revisar como restringi-lo sem impactar serviços existentes. Não promover a PR por testes de frontend isolados.

## Bootstrap auditado do primeiro proprietário — somente sob autorização

O script `infra/master-admin/bootstrap-owner.py` foi acrescentado para uma operação única. Ele exige `--principal-id` e `--confirm-principal-id` iguais, ambos UUIDs canônicos do campo imutável `id/sub` do Keycloak; comprova na API administrativa que a conta existe e está habilitada. **Não obtém privilégios a partir de e-mail, username, membership, cliente ou Workspace.** Sem `--apply`, apenas verifica e não altera o banco.

Para a execução autorizada, o operador precisa indicar a própria identidade em `--operator` e um `--audit-dir` previamente criado fora do Git com modo 0700. O script escreve uma evidência privada de intenção antes da transação SQL, bloqueia a tabela durante o teste de vazio, registra **somente** o primeiro owner e conclui o arquivo de auditoria após COMMIT. Qualquer falha deixa o registro como pendente de reconciliação, nunca aplica permissões automaticamente por heurística. As credenciais Keycloak vêm da configuração protegida por stdin; o identificador do operador e o subject confirmado devem ser obtidos/validados por um humano responsável.

**Ainda não foi executado no DevServer01:** não há `sub` de proprietário aprovado pelo usuário e o script não presume que um usuário administrativo de Keycloak seja também proprietário da plataforma. Essa separação é requisito de segurança. A revogação futura precisa ser um procedimento privilegiado distinto; não há uma rota HTTP de criação de operadores no MVP.

## Implantaçao isolada controlada (script preparado, NÃO executado)

O script `infra/master-admin/homolog-deploy.sh` foi preparado para o DevServer01. O modo **`--preflight` é não-mutante** e deve ser executado como operador root após provisionar o segredo. Sem uma role com senha, um owner explícito ou segredo entregue pelo OpenBao, ele **nega a implantação antes de alterar qualquer serviço**. O modo `--apply` só é válido na cópia isolada `/home/delmacy/syndes-platform-manager-homolog`.

Quando todos os gates de autorização estiverem satisfeitos, o script confere a proveniência do artefato de frontend do CI (inclusive se o código React, dependências ou Vite mudaram desde o bundle validado), o estado do OpenBao, DNS da Tailnet, emissor do Keycloak, permissões do arquivo de credenciais, redes e ausência de um deployment pré-existente. Somente então compila a API, monta a imagem Nginx sem Vite/AVX2, cria arquivos de configuração **sem senhas** em `/run` tmpfs, sobe **apenas** o Compose de nome `syndes-master-admin`, aguarda o frontend e registra a rota Tailnet HTTPS exclusiva `:9446`. A configuração existente do Tailscale é salva em área privada e jamais é resetada. Falhas após o início acionam rollback restrito à stack e rota.

O script de parada `infra/master-admin/homolog-stop.sh` exige o marcador de implantação bem-sucedida e remove **somente a rota HTTPS 9446 e os contêineres do Compose administrativo**, sem apagar as bases, roles, redes compartilhadas, segredos, migrações ou arquivos de backup. Depois de provisionar e implantar, repetir `bash tests/platform/platform-manager-host-gate.sh` e os testes reais de navegador/401/403. Nenhuma dessas ações de implantação foi executada nesta etapa: continuam faltando autorização de identidade e provisionamento privilegiado de segredos.

A prova CI integrada passou com Keycloak 26.8.1 real, PostgreSQL 17 descartável, API `src/main.mjs` real, role `syndes_master_api`, grants por `sub`, negativa de audiência/cliente, filtros/listagem, bloqueio de escrita SQL e revogação imediata do grant. Os dados e senhas desse job são somente fixtures e desaparecem após a execução.

## Checkpoint de execução — roteamento HTTPS do Manager (09/11/2026)

**Meta:** preparar a homologação real do Platform Manager sem reaproveitar identidade, segredo, rede ou rota de outro aplicativo. **Inspeção read-only do DevServer01:**

- PostgreSQL saudável, Keycloak/OpenBao ativos e redes internas `syndes-master-data` / `syndes-master-identity` isoladas; role `syndes_master_api` existe e possui grants de leitura no Control DB.
- A tabela `platform_operator_access` tinha **zero grants ativos**; a role do Manager **não possuía senha**; AppRole dedicada e `/run/syndes/platform-manager/master_db_url` **não estavam provisionados**. Nenhuma identidade de proprietário foi inferida de e-mail, senha ou associação com tenant.
- `tailscale serve status --json` mostrava porta HTTPS **9446 já configurada** para `http://127.0.0.1:18086`, enquanto o plano aprovado do frontend Manager é `http://127.0.0.1:18085`. Não havia container `syndes-master-admin` em execução. **Não alteramos nem desligamos essa rota**; a titularidade da configuração deve ser confirmada antes de sua realocação.
- O host gate antigo marcava a rota como PASS por simples presença da porta, sem verificar o destino: **falso positivo de prontidão**, corrigido sem ampliar permissões.

**Correção de segurança/operabilidade:** `infra/master-admin/check-tailnet-route.py` valida JSON estruturado, correspondência exata ao backend aprovado, caminho único `/`, HTTPS, ausência de Funnel e ausência de rotas concorrentes. `homolog-deploy.sh` nega qualquer porta já ocupada, verifica novamente antes de associar e só remove uma rota no rollback se ela foi criada pelo próprio deploy e permanece apontada para o destino esperado. `homolog-stop.sh` nunca desliga um handler que não aponte para o Manager. `tests/platform/platform-manager-host-gate.sh` não considera uma rota qualquer como evidência de implantação.

**Provas locais:** `python tests/platform/test-manager-tailnet-route.py` — 6 casos PASS; `python tests/platform/test-owner-bootstrap.py` — 4 casos PASS; `bash -n infra/master-admin/homolog-deploy.sh infra/master-admin/homolog-stop.sh tests/platform/platform-manager-host-gate.sh` — PASS. Os testes incluem a rota `18086` inesperada, troca de hostname, porta ocupada, múltiplos handlers, ausência de HTTPS e Funnel público. As validações do código **não substituem** auditoria do host e login real.

**Desbloqueio antes do deploy:** (1) receber indicação explícita de qual principal existente no Keycloak será o proprietário global; (2) operador autorizado provisionar AppRole/KV e senha da role com segredo só em tmpfs por procedimento OpenBao; (3) proprietário da configuração HTTPS 9446 decidir preservação, correção ou porta alternativa com redirect OIDC atualizado; (4) trazer artefato de frontend gerado pela CI a partir da revisão aprovada e repetir host gate/restore/smoke no DevServer01. **Nenhuma alteração foi executada em usuário/role/senha, KV, rede, Tailscale, container de produção ou banco de tenant nesta etapa.**
