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
