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

## Gates restantes

1. Provisionar/validar cliente OIDC `syndes-master-admin` no realm `syndes`, com Authorization Code + PKCE S256, sem direct grant, implicit ou service account, redirect HTTPS restrito e audience `syndes-master-api`. Script audível `infra/master-admin/keycloak-homolog.py` lê credenciais operacionais por **stdin** sem registrá-las; guardar identificador criado fora do Git.
2. Obter domínio/origem **privados e exclusivos** do Manager. Porta HTTPS diferente na mesma máquina é origem distinta, mas ainda compartilha domínio de cookies — homologação temporária apenas, não uma afirmação de separação definitiva de domínio de produção.
3. Provisionar credencial de `syndes_master_api` por OpenBao sob AppRole escopada, sem senha em Git/env permanente, e testar apenas a Control DB.
4. Provisionar principal proprietário por `sub` imutável de Keycloak em workflow auditado; não derivar de nome, e-mail ou membership de cliente. Sem grant, nenhum login pode receber metadados.
5. Build independente API/UI e **deploy isolado** apenas depois dos gates acima. HTTPS em Tailnet, verificações reais 401/403, PKCE, rede, papel SQL, e screenshot marcado como real. Somente então avaliar merge da PR e Product Gate #31.

## Rollback seguro — nunca automático sobre dados compartilhados

- Se Manager subir, parar **somente** `infra/master-admin/compose.yaml` (`docker compose ... down` dessa stack), sem `down -v` dos serviços compartilhados.
- Revogar o client de homologação por UUID gravado pelo provisionador, não por busca arbitrária de nomes (`keycloak-homolog.py --rollback`), e retirar apenas o binding criado para o owner de teste.
- Para reverter as bridges sem reiniciar containers: `docker network disconnect syndes-master-data syndes-postgres-postgres-1`; `docker network disconnect syndes-master-identity syndes-security-access-keycloak-1`; depois `docker network rm syndes-master-data syndes-master-identity`. **Não desconectar as redes originais.**
- O schema SQL é aditivo e pode permanecer sem operadores. Para desabilitar a role, primeiro impedir novas sessões; revogar/invalidar a credencial por procedimento DBA. **Não executar DROP TABLE ou restaurar o banco de dados compartilhado de forma automática**: revisar se há registros novos e coordenar recuperação.
- Backups permanecem no host, sem commit, e só podem ser restaurados conforme janela aprovada; revalidar checksum e dependências antes de um restore operacional.

## Proibições desta etapa

Não tocar em bancos tenant, dados CRM/Inbox/WhatsApp, SQL 002, PR #27, checkout de Workspace do DevServer01 ou rede `syndes-data`/`syndes-security-access` existente. Não alterar serviço Traefik/Tailscale existente nem expor nova rota pública enquanto o acesso ainda não estiver completo e verificado.
