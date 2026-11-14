# I11 — Release e Rollback | Referência técnica

> **INVENTÁRIO DOCUMENTAL NÃO AUDITADO.** Só descreve arquivos/declarações presentes no repositório; não representa funcionalidade implantada.

## Stack e ownership

- **Fonte:** [infra/master-admin/homolog-deploy.sh](https://github.com/delmacy/syndes-system/tree/main/infra/master-admin/homolog-deploy.sh) — arquivo.
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

---

## Contratos observados na fonte — auditoria estática 2026-11-14

- Entradas CLI: `--preflight` (padrão) e `--apply`; outras entradas retornam código 2.
- Pré-condições: checkout aprovado, Docker/jq/Tailscale/Python, PostgreSQL healthy, Keycloak running, redes internas, owner ativo, OpenBao acessível e segredos em tmpfs com modos definidos.
- Proveniência: `artifacts/web-dist/CI_ARTIFACT_MANIFEST.json`, `git_commit` e comparação de fontes frontend entre commit do artefato e HEAD; rejeita alterações tracked não commitadas.
- Identidade e rota: DNS `*.ts.net`, issuer Keycloak, validação da disponibilidade da porta 9447 e publicação via `tailscale serve` privada; não há `funnel` na fonte.
- Efeito do apply: escreve arquivos runtime em `/run`, faz builds locais, sobe `infra/master-admin/compose.yaml`, verifica HTTP local e configura Serve. **Não executar sem autorização operacional.**
- Falha após início: trap remove apenas rota 9447 quando atribuída e derruba stack Manager. Não reverte dados, migrações ou serviços externos.
- Não se trata de API HTTP pública, migration ou módulo JavaScript exportável. Contratos de Docker, Keycloak, OpenBao e DB pertencem aos respectivos owners.
