# I07 — Tailnet | checkpoint de auditoria de código (2026-11-13)

**Base:** `main@05d46cab41ada756942c0762ec028ba62dfbe438`. **Estado:** auditoria documental parcial, sem validação de ambiente nem homologação.

## Fonte verificada via GitHub

- [`infra/master-admin/check-tailnet-route.py`](https://github.com/delmacy/syndes-system/blob/05d46cab41ada756942c0762ec028ba62dfbe438/infra/master-admin/check-tailnet-route.py), blob `d51f6e69f2b0a04670eaf7c7119950fa53da1452`.
- [Runbook histórico Workspace](https://github.com/delmacy/syndes-system/blob/05d46cab41ada756942c0762ec028ba62dfbe438/docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md). Configuração histórica de Tailnet e serviços não comprova a configuração atual.
- A auditoria I06 anterior registra referência ao middleware `syndes-tailnet-only@docker`, mas não sua definição/efetividade. I06 e I07 têm responsabilidades distintas.

## Contrato do verificador

`check(config, mode, port=9447, target="http://127.0.0.1:18085")` recebe objeto JSON estruturado de Tailscale Serve e retorna tupla `(bool, message)`. `main()` lê JSON de stdin; `--mode` exige `free` ou `active`; `--port` padrão 9447 e target fixo. Saída CLI `PASS:`/ `BLOCKED:`; código de saída 0/2.

- `free`: só aprova quando não existe ocupação de porta no mapeamento TCP nem rota Web correspondente.
- `active`: exige uma rota Web única, `TCP[port].HTTPS is True`, `Handlers` com somente `/`, proxy exatamente para `http://127.0.0.1:18085` e ausência de `AllowFunnel[hostname] is True`.
- Estrutura inválida, target diferente, porta fora de 1..65535 ou JSON inválido falham fechados. O código evita imprimir hostnames Tailnet.
- **Limite:** análise estática do código não prova que o script foi executado, que a rota existe, que o Manager está implantado, que TLS funciona ou que ACLs bloqueiam acesso indevido.

## Ownership e ausências

I07 é componente de rede/acesso privado vinculado a I02. O script Python não define API HTTP própria, frontend, tabelas SQL, migration ou eventos de domínio. Não criar testemunhas AST TypeScript artificiais. A configuração real do Tailscale, permissões, autenticação e roteamento exigem verificação operacional autorizada.

## Gates pendentes

1. Testar `check` com fixtures descartáveis: rota livre, ativa válida, conflito de porta, duplicidade, target errado, HTTPS ausente, Funnel ativado e JSON inválido.
2. Conferir a configuração Tailscale Serve efetivamente carregada, sem expor hostnames/credenciais.
3. Confirmar isolamento por ACL e negativa de acesso não autorizado; conferir vínculo com o middleware de I06.
4. Conciliar ownership e critérios de aceite na WBS, com evidência por SHA.
5. Atualizar as oito matérias independentes sem transformar proposta em implementação; preservar documentação canônica.

**Nenhum gate operacional foi executado neste checkpoint.**
