# Q10 — Quality Gates | Referência técnica

> **AUDITORIA ESTÁTICA PARCIAL — 12/11/2026.** Fontes versionadas no checkout `origin/main` SHA `69670e27e5c8e22240642f5cde67986ac0e8376b`. Q10 tem ownership de `tests/integrity`: **não é módulo executável, API, banco, frontend ou engine de testes de todo o Syndes**. As suites transversais pertencem aos respectivos owners.

## Stack e ownership

- **Fonte da Q10:** `tests/integrity`, `AGENTS.md`, `repository-structure.sh`; execução com Bash/Node para verificação de estrutura e catálogo.
- **Dependências de processo:** `scripts/architecture/check-work-units.mjs`, `catalog/work-units.json` e `AGENTS.md` nos módulos.
- **Composição de CI:** `.github/workflows/syndes-ci.yml` → `foundation`, `impact`, `regression`, `support-browser-parity`, `platform-manager-parity` e `gate`.
- **Estratégia de testes:** [TEST-STRATEGY](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/TEST-STRATEGY.md) define camadas e RC. Ela não comprova que todas as camadas estejam automatizadas, executadas ou aprovadas.

## Funções e checagens reais

| Fonte | Comando ou interface | Efeito observável pelo código |
|---|---|---|
| `tests/integrity/repository-structure.sh` | `bash tests/integrity/repository-structure.sh` | Requer arquivos e AGENTS não vazios; chama verificação do catálogo; retorna status diferente de zero para falha |
| `scripts/architecture/check-work-units.mjs` | `node scripts/architecture/check-work-units.mjs` | Testa estrutura/invariantes de ownership do catálogo, sem homologar módulos |
| `scripts/ci/plan.mjs` (Q07) | `selectSuites`, `installedSuites`, modos impact/full | Determina suites a partir de caminhos e lockfiles encontrados; não é gate em si |
| `scripts/ci/run-suite.sh` (Q07) | `bash scripts/ci/run-suite.sh <suite>` | Executa a suíte específica por tipo, requer serviços descartáveis em alguns caminhos |
| `scripts/ci/parity.test.mjs` (Q07) | `node --test scripts/ci/*.test.mjs` | Prova paridade histórica/seleção de suites; atualmente falha no mainline auditado |

**Limite:** a aprovação requer **resultado do comando executado no SHA**, não apenas os comandos descritos aqui. Não executar scripts destrutivos ou com credenciais reais por inferência desta documentação.

## APIs, contratos, eventos e dependências públicas

**Q10 não oferece controller HTTP, `package.json#exports`, evento de negócio, port de runtime nem assinatura de schema.** O contrato da Q10 é de **qualidade**: checagem de integridade com exit code, evidência vinculada ao commit e rastreabilidade dos gates.

- [Contratos públicos dos módulos](../../standards/CONTRATOS-PUBLICOS.md) são verificados por owners, testes de consumidores e API/contratos das unidades responsáveis.
- Unit, integração, E2E, segurança, infra e performance pertencem a Q02/Q03/Q04/Q05/Q09/Q06 e seus módulos.
- Product Gate é decisão do responsável, não resposta de endpoint.
- `syndes-ci.yml` falhando em paridade **não pode ser aprovado** por novo link do Docs ou por execução local de teste de estrutura.

## Frontend e visualização

Q10 **não possui frontend de aplicação**. O portal Syndes Docs indexa matriz de qualidade e STATUS; não controla GitHub Actions, releases, autorização ou ambiente operacional. A interface mostra requisitos e vínculos, não comandos de promoção.

## Schemas e migrations

**Q10 não possui tabelas PostgreSQL, schema próprio, migrations nem dependência de banco operacional.** Os testes de migrations e restore estão sob ownership de módulos, infraestrutura e equipes de qualidade; prova descartável de PostgreSQL não equivale a migration aplicada/backup restaurado em produção.

## Testes e indicadores auditáveis

- **Gate estrutural:** `tests/integrity/repository-structure.sh`, AGENTS locais e catálogo.
- **Gate CI central:** `syndes-ci.yml` usa `foundation` + seleção por impacto/full; [falha observada no run 43335397128](https://github.com/delmacy/syndes-system/actions/runs/43335397128), com paridade reprovada.
- **RC:** stress, spike, soak, restore, autorização E2E e janela de release só contam se executados e aprovados no SHA/ambiente apropriados.
- [STATUS Q10](STATUS.md) expõe bloqueios, fontes e próximos passos; [WBS](EVOLUCAO.md) mantém os cinco IDs associados sem inventar progresso.
