# I08 — Komodo | Referência técnica

> Inventário técnico **sem prova de implementação ou deploy**. Base GitHub `891559a6cb8f2e4f0c64e561cad175911ec947d2` (2026-11-13).

## Ownership e fontes
- Unidade `I08` declarada em `catalog/work-units.json` e `docs/subprojects/index.json`, com fonte genérica `infra`.
- `infra/README.md` documenta projetos Compose de PostgreSQL, Security/Access, Core Host e Platform Manager planejado; **não atribui Komodo a um serviço verificado**.
- Não foram encontrados, nos caminhos pontualmente consultados, `infra/komodo/README.md`, `infra/komodo/compose.yaml`, `infra/komodo/compose.yml` ou variantes `docker-compose.*`. Isso **não prova inexistência** em outros caminhos ou branches.

## Backend, contratos públicos e privados
- Classes, métodos, executáveis, imagem/container, API e autenticação do Komodo: **não verificados**.
- Nenhum export, endpoint HTTP, consumer, evento ou contrato versionado pode ser afirmado.
- Não associar interfaces de terceiros ao Syndes sem fonte e teste.

## Dados, schemas e migrations
- Nenhuma tabela, migration, schema ou banco específico de Komodo foi comprovado.
- Não executar SQL ou criar grants para completar documentação.

## Frontend e infraestrutura
- Nenhuma tela, rota de frontend, RBAC, integração Tailnet, TLS ou proxy específico de Komodo comprovados.
- A existência de Traefik/Tailnet em outros owners não prova isolamento do Komodo.

## Testes e gates
- Não foram executados testes de Komodo nem observado runtime.
- Pendente: identificar manifest, configuração segura sem segredos, testes, caminhos de acesso, persistência, backup/restore e autorização operacional.

## Navegação temática
[00 Fontes](chapters/00-enderecos-exatos-de-leitura.md) · [01 Missão](chapters/01-missao-objetivos-e-fronteiras.md) · [02 Casos de uso](chapters/02-requisitos-historias-e-casos-de-uso.md) · [03 Capabilities](chapters/03-capabilities.md) · [04 Contratos](chapters/04-contratos-e-dependencias-publicas.md) · [05 Arquitetura](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md) · [06 WBS](chapters/06-wbs-marcos-e-aceite.md) · [07 Escopo](chapters/07-controle-do-escopo.md).
