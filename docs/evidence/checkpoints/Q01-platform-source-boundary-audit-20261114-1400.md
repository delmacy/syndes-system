# Q01 — Plataforma de testes: auditoria de fronteiras e evidências (2026-11-14)

- **Base main verificada via GitHub MCP:** `1cf48cc0a1281017ac58f7b9b9747f663109e151` (commit de documentação CRM).
- **Escopo:** leitura estática de Q01; sem alteração de runtime, migrations, CI, workflows, branches alheias ou DevServer.
- **Estado:** auditoria parcial; nenhuma promoção a homologado.

## Inventário de fontes e contratos

- `docs/subprojects/Q01-plataforma-de-testes/{STATUS,REFERENCIA-TECNICA,IMPLEMENTACAO}.md` e `chapters/04-contratos-e-dependencias-publicas.md` foram confrontados com fontes.
- Q01 possui scripts de testes em `tests/platform/`, não API HTTP, classe de domínio, schema/migration, frontend ou eventos próprios. Contrato externo: comandos/fixtures/exit codes e evidência correlacionada ao SHA. Infraestrutura, bancos, autenticação, rotas e eventos exercitados pertencem a outros owners.
- `tests/platform/postgres-smoke.sh`: verifica DBs Control/Keycloak/OpenFGA, autorização positiva Keycloak no DB próprio, negativa contra Control, provisionamento idempotente de tenant, negativa da role Core contra DB de tenant e dump/restore em DB CI descartável. O script **cria e remove banco**; não é seguro executar em host compartilhado.
- `tests/platform/core-host-runtime-smoke.sh`: exige `GITHUB_ACTIONS=true` e `CI_RUNTIME_SMOKE=1`; constrói/inicia container Core Host, verifica health/ready, assets, rotas 401/404/405, ausência de bind público e nomes de credenciais bootstrap no ambiente. A mensagem final PASS só é produzida se os checks passarem; não foi executado nesta auditoria.
- `tests/platform/platform-manager-network-smoke.py`: executa testes isolados de Tailnet, OIDC, operator provisioning e release checkout; valida JSON Compose e usa redes/containers temporários para negativa de conectividade. Apesar do nome smoke, **cria redes, puxa imagens e executa containers**; não foi executado.
- `tests/platform/test-manager-tailnet-route.py`: casos de preflight, alvo privado, portas 9446/9447, rotas ambíguas, HTTP, Funnel booleano true, JSON inválido e não divulgação de hostname. **Não inclui caso explícito para AllowFunnel malformado não booleano**, lacuna de cobertura a considerar no owner I07.
- `tests/platform/support-migration-gate.test.sh`: testes positivos e negativos do helper de migrations Support, além de asserts estáticos de sua chamada no instalador. Pertence à fronteira Support/infra; não comprova migration aplicada.
- `tests/integration`, `tests/security` e `tests/performance`: apenas `AGENTS.md` na árvore desta revisão; suites reais são distribuídas. Não há benchmark de performance demonstrado por esses arquivos.

## Evidência CI e divergências

- Run histórico [43340637846](https://github.com/delmacy/syndes-system/actions/runs/43340637846): GitHub API confirma `completed/success` no SHA `bd0aa69349879485156ce05ffcb211904d34c206`, iniciado em 2026-11-13 00:53:22 UTC. **Não é CI do main atual** `1cf48cc0`. Contagem 24/24 citada no STATUS não foi recontada nesta execução.
- A descrição Q01 de scripts, ausência de API própria e fronteira Q07/Q10 é compatível com os arquivos amostrados. **Divergência material nova não demonstrada nesta amostra**; cobertura de AllowFunnel malformado é lacuna concreta de testes I07, não prova de falha operacional.
- Não inspecionados integralmente: todos os scripts de `tests/platform`, cada suite dos módulos, jobs individuais do CI, artefatos, deployment e public GitHub Pages SHA. Não afirmar divergências globais zero.

## Limites e próximos gates

Nenhum teste foi executado, nem SQL, Docker, rede, migration ou segredo. Sem DevServer. Não há evidência nesta execução de staging/produção, recuperação operacional, RPO/RTO, carga p95/p99, Product Gate ou homologação.

Próximos passos: mapear cada caso de teste por requisito e owner, validar negativos de I07 (AllowFunnel malformado), correlacionar jobs ao SHA atual, revisar gaps Q02–Q10, conferir 57 unidades e novos owners, revisar integração documental e SHA publicado no GitHub Pages. Manter este checkpoint isolado até gates de revisão.
