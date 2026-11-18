# Homologação de identidade CRM/Inbox — DevServer01

**Escopo:** provisionar uma identidade Keycloak dedicada, sem herdar a conta `syndes-manager`, sem atributos de administrador global, sem senha fixa em código ou logs, sem acesso implícito ao CRM/Inbox. Esta preparação **não aprova** o Product Gate P02.

## Identidade proposta
- Realm: `syndes`.
- Username: `syndes-homolog-crm-inbox` (não é a conta do Platform Manager).
- Atributo de propósito exclusivo: `crm-inbox-operational-acceptance`.
- Status no Keycloak: `enabled`, com `UPDATE_PASSWORD` obrigatório, **sem credencial** no provisionamento.
- Sem criação de clientes OIDC, roles administrativas, memberships SQL, autorização OpenFGA, tenant ou contatos.
- O Keycloak `sub` só é registrado no DevServer01 em `/home/delmacy/syndes-releases/.homolog-identity/keycloak-crm-inbox.json` (0600, diretório 0700). Nunca inserir `sub`, senha ou token em issues, PR ou logs Actions.

## Procedimento autorizado e evidência
O provisionador é `scripts/identity/provision-homolog-keycloak.py`. O caminho de execução é **GitHub Actions → OIDC/Tailscale → SSH → script em stdin**, sem checkout, build, aplicação ou migração no servidor. O job `provision-homolog-identity` faz parte do workflow CD já existente e depende de `tailnet-preflight` PASS. Só aceita CI verde de `push` em `main`, com proprietário `delmacy` e assunto de commit de release *one-shot* `chore(auth): provision isolated Keycloak homologation principal 2026-11-17`. O código verifica também o SHA efetivo da `main`.

O script só alcança a instância Keycloak do projeto Compose operacional `syndes-security-access`, usa o admin bootstrap já montado como Docker secret, nunca o imprime e falha com username existente incompatível. Sua operação `--check` não cria usuários. `--apply` só cria o usuário e a evidência privada.

**A criação de usuário não torna o login funcional.** Por não gerar senha no pipeline, um operador autorizado deve criar uma senha temporária na administração do Keycloak e exigir substituição no primeiro login, preferencialmente por canal privado de recuperação. Não colocar senha no GitHub Actions, chat, README ou logs.

## Etapa seguinte: autorização mínima, ainda bloqueada
É proibido inserir uma membership no primeiro tenant ativo que aparecer. Antes de qualquer `INSERT` em `syndes_control.tenant_memberships`:
1. Verificar qual tenant **dedicado de homologação** pode receber a conta; validar estado ativo, custódia e inexistência de dados comerciais.
2. Vincular o `sub` imutável do usuário a **somente esse tenant** com aprovação operacional e trilha de auditoria privada.
3. Conceder no OpenFGA apenas `resource:sha256(tenantUUID + "|" + "crm:people")` e/ou `inbox:conversations` em relação `viewer`, com escopo necessário e revogação testável. Não conceder `tenant:member` como atalho: o modelo atual herda `can_read` de recursos ligados ao tenant.
4. Validar login **Authorization Code + PKCE S256** no cliente real do CRM/Inbox; verificar `iss/aud/azp` sem registrar o JWT.
5. Executar matriz negativa de wrong-client, ausência de membership, cross-tenant, ausência de `can_write` e revogação.

Não remover SQL 002, não habilitar multi-org, não adicionar grant ao Platform Manager ou tenant comercial, não alterar controles de recuperação do deploy. A aprovação do Product Gate exige ainda backup+restore operacional.
