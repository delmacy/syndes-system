# Q10 — Quality Gates: limites de integridade do catálogo (2026-11-16)

- **Base examinada:** main `1cf48cc0a1281017ac58f7b9b9747f663109e151`; branch exclusiva `audit/q10-quality-gates-catalog-boundary-20261116-0625`.
- **Owner:** Q10 (`tests/integrity`). Fontes: `tests/integrity/repository-structure.sh`, `scripts/architecture/check-work-units.mjs`, `catalog/work-units.json`, `.github/workflows/syndes-ci.yml`, `scripts/ci/parity.test.mjs`, `tests/AGENTS.md` e `docs/engineering/MAINLINE-CI-POLICY.md`.

## Contrato público versus verificação privada

1. **Q10-CATALOG-01 — integridade estrutural, não comprovação de maturidade.** O checker exige exatamente 57 IDs (P14/A8/C8/I12/Q10/G5), unicidade, frente, caminho existente, valores permitidos de `maturity`, e `AGENTS.md`/package para módulos P classificados como `code`. Não verifica se `verified`, `partial`, `code` ou `distributed` correspondem a testes aprovados, deploy, homologação, migrations aplicadas ou aceite. O próprio catálogo declara `purpose: Ownership only, not deployment/acceptance status`. Não promover esses valores a evidência operacional.
2. **Q10-CATALOG-02 — inventário fechado de 57 unidades.** `assert.equal(data.units.length,57)` e contagens fixas impedem cadastrar novo owner sem alterar o checker. Isso protege o catálogo atual, mas não descobre automaticamente novos owners de código/infra; a auditoria deve manter inventário separado de descobertas até revisão explícita. Não é defeito comprovado de runtime.
3. **Q10-GATE-03 — presença textual versus execução.** `repository-structure.sh` verifica arquivos não vazios, `AGENTS.md` e chama o checker. `parity.test.mjs` verifica vários contratos por presença de fragmentos de texto e nomes de workflows. O job `foundation` os executa declarativamente; o resultado efetivo da Actions para o SHA examinado não foi consultado nesta inspeção. Presença de strings não comprova comportamento, autorização, isolamento entre tenants ou paridade executada.

## Interfaces e fronteiras

Q10 é governança de repositório e CI, não um serviço de negócio. Nenhuma API HTTP, classe de domínio, evento de negócio ou migration própria foi identificada nos arquivos examinados; isso **não** é inventário exaustivo de `tests/integrity`. A política declara que a `main` não possui proteção administrativa obrigatória nesta fase: um YAML com gate não equivale a bloqueio de merge ou aceite de release. A suíte de segurança exige cross-tenant leaks, unauthorized access, corrupted records e silent message loss iguais a zero, mas estes invariantes não são provados pelo checker de catálogo.

## Evidência, execução e pendências

- **Confirmado:** existência e conteúdo dos arquivos acima na main examinada; regras estáticas e encadeamento declarados no workflow.
- **Não executado:** Node, Bash, CI, build, testes, SQL, migrations, Docker, deploy, inspeção de DevServer ou merge. Nenhum resultado de teste ou estado operacional é atribuído ao SHA.
- **Pendente:** reconciliar os 57 owners e descobertas adicionais; conferir resultados CI por SHA, gates humanos e SHA servido pelo GitHub Pages; separar explicitamente existência de fonte, testes aprovados e implantação/homologação. Divergências globais não estão zeradas.
