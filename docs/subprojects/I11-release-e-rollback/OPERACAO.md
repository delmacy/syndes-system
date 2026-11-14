# I11 — Release e Rollback | Operação

> **Runbook de leitura e revisão, não homologado.** Não executar comandos operacionais, preflight, apply, SQL, migrations, alterações de segredos ou deploy a partir desta documentação.

## Fonte e fronteira

[Script auditado no GitHub](https://github.com/delmacy/syndes-system/blob/696f8e59a369dba593681e82293e104bef0a6e08/infra/master-admin/homolog-deploy.sh) (blob `39f85b3`). O script restringe o ambiente a checkouts aprovados do Manager; não serve como procedimento genérico de release do Syndes inteiro.

## Sequência de controles identificados estaticamente

1. **Escopo:** checkout aprovado e modo de execução explícito.
2. **Dependências:** Docker, jq, Tailscale, Python 3, PostgreSQL, Keycloak e redes internas.
3. **Autorização:** role e owner do banco, disponibilidade OpenBao e permissões de segredos em tmpfs.
4. **Proveniência:** artefato CI, manifesto, SHA e ausência de alteração do frontend após build.
5. **Identidade:** DNS Tailnet, issuer OIDC esperado e rota HTTPS privada 9447 sem conflito.
6. **Rollback:** limitado aos recursos do Manager definidos no script; não restaurar banco ou estado externo por inferência.

**Esses são controles declarados em fonte, não resultados de execução.** Não há logs de aplicação, testes ou aceite nesta revisão.

## Evidências obrigatórias antes de declarar operação validada

Registrar SHA do artefato e do código, ambiente autorizado, identidade do aprovador, execução isolada dos gates, resultados de smoke, evidência de rollback e recuperação de dependências, sem divulgar segredos. Exigir owner e revisão de segurança. Somente atualizar [STATUS](STATUS.md) após evidência verificável.

## Gates documentais independentes

MkDocs estrito, validação de links e registry devem ser executados em ambiente isolado, sem invocar o script operacional. Reconciliar a branch com o main atual e conferir o SHA publicado no GitHub Pages. Até lá, **não integrar**.

Referências: [referência técnica](REFERENCIA-TECNICA.md), [escopo](ESCOPO.md), [evolução](EVOLUCAO.md), [contratos públicos](../../standards/CONTRATOS-PUBLICOS.md).
