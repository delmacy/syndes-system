# Platform Manager — provisionamento operador OpenBao (10/11/2026)

**Escopo exclusivo:** primeiro bootstrap da role PostgreSQL `syndes_master_api`, do KV v2 `kv/data/production/platform-manager` e da AppRole `syndes-platform-manager`. Não cria conta Keycloak, não concede owner, não altera tenants, Core Host, OpenFGA, Workspace nem GitHub Actions.

## Pré-requisitos

- O operador utiliza `sudo` **diretamente** no DevServer01 e dispõe de token administrativo **pré-existente e autorizado** no OpenBao. Esse token **não pode** ser enviado para o chat, command-line, Docker env, Git ou históricos.
- OpenBao inicializado e unsealed, mount existente `kv/` em versão 2 e autenticação `approle/` **já habilitada**. O script **não** cria novo root token, não recupera unseal shares e não habilita mounts globais.
- O certificado **público** e confiável do serviço é `/srv/syndes-lab/system/infra/security-access/openbao/tls/server.crt`. TLS é validado por CA e SAN `openbao`; a conexão usa apenas a bridge interna `syndes-secrets`.
- Um único `owner` ativo já existe no Control DB; a role dedicada existe, é não-superusuário e ainda não possui senha. A role não tem autorização para tenant DBs.
- `/run` precisa ser `tmpfs` e `/run/syndes` privado de root. O registro de auditoria estará em `/var/lib/syndes-platform-manager/bootstrap-audit.json` (permissões `0600`).

## Comando seguro e único de operador

No shell do **DevServer01** (não no chat):

```bash
cd /home/delmacy/syndes-manager-openbao-provision-20261110
sudo python3 infra/master-admin/openbao/operator-provision.py --preflight
sudo python3 infra/master-admin/openbao/operator-provision.py --apply
```

No `--apply`, o script solicita o token administrativo do OpenBao por entrada oculta do terminal, sem eco nem logs. Não passar token via argumentos ou variáveis de ambiente. **Não executar `--apply` se o preflight falhar**. Para novas cópias/versões, confirmar primeiro SHA aprovado no `main`.

## Efeitos limitados e critérios de aceite

O script recusa bootstrap duplicado, montagens inesperadas, role SQL já provisionada, ausências de KV/AppRole e políticas divergentes. Ele cria apenas a política `syndes-platform-manager-runtime`, AppRole `syndes-platform-manager` com token curto e um SecretID restrito; grava uma senha SQL base64url aleatória em KV v2 com CAS=create-only e a instala na única role `syndes_master_api` usando `psql` via **stdin**. Entrega apenas `role-id`/`secret-id` em `/run/syndes/approle/platform-manager` (`0600`) e invoca o renderizador TLS existente, que publica `master_db_url` no tmpfs com UID 1000, modo `0600`, e revoga o token de workload.

O operador recebe só estado e caminho de auditoria. **Nenhum valor de senha, ID secreto ou token deve aparecer na saída.**

A operação não é transacional entre OpenBao e PostgreSQL. Se algum passo falhar após o início, o registro ficará marcado `manual_reconciliation_required`; a próxima execução não tentará sobrescrever o estado parcial. Reconciliação/revogação exigem aprovação de um operador habilitado.

## Observação operacional importante

A imagem do frontend atual `89772e9` foi construída com o bundle da CI, porque o Vite/Oxc não executa no CPU do DevServer01 (`SIGILL`, exit 132). A versão do bundle foi verificada pelo SHA-256 durante a transferência privada. Não fazer build do Vite diretamente no host. Os containers reais continuam **não implantados** enquanto não houver segredo e preflight completo. A prévia visual em `:9446` deve permanecer intocada; Manager real previsto para `:9447` com destino `127.0.0.1:18085`.

Antes do deploy real: reconciliar o checkout aprovado com a imagem/bundle do SHA corrente, executar `homolog-deploy.sh --preflight` como operador, validar client OIDC redirect e exclusividade de rede, então executar `--apply`, host gate e E2E autenticação/negação; a CI verde e o smoke HTTP isolado são necessários, mas não suficientes.
