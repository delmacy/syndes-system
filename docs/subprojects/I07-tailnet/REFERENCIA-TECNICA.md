# I07 — Tailnet | Referência técnica

> **INVENTÁRIO DOCUMENTAL NÃO AUDITADO.** Só descreve arquivos/declarações presentes no repositório; não representa funcionalidade implantada.

## Stack e ownership

- **Fonte:** [infra/master-admin/check-tailnet-route.py](https://github.com/delmacy/syndes-system/tree/main/infra/master-admin/check-tailnet-route.py) — arquivo.
- **Owner:** declarado em `catalog/work-units.json`. Contratos públicos de outros owners não podem ser alterados diretamente.
- **Stack/manifests:** não foi encontrado package.json nesta fonte; auditar o artefato antes de declarar framework.

## Backend: classes, métodos e responsabilidades

**A AUDITAR:** inspecionar código e testes, assinaturas, parâmetros, efeitos e erros. Não publicar API privada como contrato.

## Contratos públicos, APIs e eventos

[Índice normativo de contratos](../../standards/CONTRATOS-PUBLICOS.md). Imports, endpoints e consumers exigem evidência de export, versão e compatibilidade.

## Frontend: aplicações, telas e componentes

**A AUDITAR:** conferir telas em Workspace, Manager ou Support e componentes compartilhados; não inferir rota a partir do nome da unidade.

## Schemas e migrations

### Tenant DB

Tabelas e migrações precisam de ownership e prova de aplicação; arquivo SQL presente não equivale a mudança executada.

Nenhuma migration em subpasta SQL nesta fonte; isso **não** comprova ausência de persistência.

### Control / Manager DB

Nenhuma tabela pode ser atribuída ao Control por inferência; confirmar owner e schema. Negócio do cliente fica no Tenant DB.

## Diagramas, testes e pendências

- [Escopo](ESCOPO.md) · [Evolução](EVOLUCAO.md) · [Status](STATUS.md) · [Histórico](HISTORICO.md).
- **Próximo passo:** auditar classes/exports, contratos, telas, tabelas, testes e evidências sem inventar funcionalidades.

## Auditoria de símbolos — base 1cf48cc0 (2026-11-14)

Fonte `infra/master-admin/check-tailnet-route.py` (blob `d51f6e69f2b0a04670eaf7c7119950fa53da1452`). `check(config, mode, port=9447, target="http://127.0.0.1:18085")` retorna tupla `(bool, mensagem)`, sem modificar configuração. `main()` lê JSON da entrada padrão, restringe modo a `free|active`, porta a 1–65535 e destino ao loopback fixo; retorna 0 para PASS e 2 para BLOCKED. `check` examina `TCP`, `Web`, `Handlers`, `Proxy` e `AllowFunnel` na estrutura recebida. Não há chamada à API Tailscale nem alteração de Serve neste arquivo. Formato real de JSON, identidade do hostname, TLS efetivo, autenticação, conectividade e implantação permanecem sem prova. Não atribuir API HTTP, tabela, migration ou interface a esta fonte Python.
