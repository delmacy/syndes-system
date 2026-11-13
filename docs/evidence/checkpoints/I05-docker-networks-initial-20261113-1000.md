# I05 — Docker e redes: inventário inicial de código e runtime

> **AUDITORIA INICIAL, SOMENTE LEITURA — 13/11/2026.** Base de documentação local `c26df97`. Sem alteração de Docker, rede, volumes, containers, secrets, firewall ou aplicação. Não promover I05 a parcialmente homologado até reconciliação documental e provas suficientes.

## Continuidade Git e escopo

- `origin/main` observado em `75d99e087896531013241b4e45c3318bab2e71b1`; integração documental local `docs/publication-gate-20261113` em `ec037df` **não publicada**.
- A06 já reconciliado em `3c1db91`; A04 já reconciliado em `c26df97`. Plano dessa base: **18/57** STATUS parcialmente auditados, 39 baseline. A próxima unidade baseline pela ordem do catálogo é **I05 — Docker e redes**, componente de I02.
- Worktrees de código e publicação preservadas. O comando `rg` não está instalado no DevServer01; inspeção realizada com `find` e `grep`.

## Artefatos versionados e fronteiras

| Fonte | Contrato observado | Limitação |
|---|---|---|
| `infra/postgres/compose.yaml` | PostgreSQL `17-bookworm`, serviço `postgres`, volume `postgres_data`, redes externas `syndes-data` e `syndes-master-data`, healthcheck | Não equivale a restore, least privilege ou firewall de host |
| `infra/security-access/compose.yaml` | Keycloak `26.8.1`, OpenFGA `v1.22.1`, OpenBao `2.7.0`, job `openfga-migrate`, redes `syndes-data`, `syndes-security-access`, `syndes-secrets` e `syndes-master-identity`; `syndes-secrets` é `internal: true` | `openfga-migrate` é operação potencialmente mutável; não executado. OpenBao Up não prova unsealed |
| `infra/master-admin/compose.yaml` | `master-api`, `master-web`; `master-private` é `internal: true`; `read_only: true` e `cap_drop: [ALL]` declarados para ambos | Não comprova todas as restrições efetivas ou segurança do ingress |
| Compose/stack adicionais | Alguns workloads (Core Host, Workspace, WhatsApp, Komodo) são gerenciados fora dos três Compose inventariados | Não concluir que o inventário cobre todos os stacks ou conexões |

## Observação runtime sem inspeção de dados

`docker ps --format` indicou **16 containers Up** (entre eles `syndes-postgres-postgres-1` e `syndes-platform-manager-visual` com indicação healthy, OpenBao, OpenFGA, Keycloak, Core Host, Workspace, WhatsApp, Komodo e instância PG17 de teste). `docker network ls` indicou redes bridge locais `syndes-data`, `syndes-master-data`, `syndes-master-identity`, `syndes-secrets`, `syndes-security-access`, `syndes-web`, `syndes-whatsapp-egress` e redes Komodo. **Não foram consultados containers por `docker inspect`, conexões, IPs, volumes ou dados de secrets.**

## Validações

- `python3 scripts/docs/audit_consistency.py --check`: **18 partial / 57 units; 39 baseline; discrepancies 0**.
- `python3 scripts/docs/source_evidence.py --json`: `issues: []` em modo lexical.
- Não houve execução de `docker compose up`, migration, testes destrutivos, alterações de ACL, acesso a bancos ou verificação de rotas externas.
- O catálogo e o registry existentes não medem automaticamente cobertura total de redes; 0 divergências neles **não é prova de isolamento**.

## Bloqueios, próximos gates e critérios de aceite

1. Inventariar fontes de configuração de todos os stacks, incluindo Compose Komodo e configurações efetivas de serviços fora dos três Compose principais; conferir owner por rede e container.
2. Verificar com aprovação operacional `docker inspect` **sanitizado** (sem variáveis de ambiente, mounts de segredo, tokens ou IPs privados), redes efetivas, `internal`, portas publicadas, políticas de ingress/egress e privilégios dos containers. Não confundir redes bridge com isolamento de host.
3. Executar `docker compose config --quiet` em ambiente isolado **sem valores de segredo** e registrar SHA/versão das fontes; se houver `env_file` privado, não materializar/ler sem autorização.
4. Reconciliar I05 STATUS, REFERENCIA-TECNICA, OPERACAO, oito capítulos temáticos e WBS em worktree documental separada. Não atribuir a I05 responsabilidades I06 Traefik, I07 Tailnet, I08 Komodo ou I12 hardening.
5. Prosseguir I06 — Traefik HTTPS após reconciliação. Validar publicação GitHub Pages por revisão/CI: HTTP 200 isolado é insuficiente.

**Gates de segurança:** configuração declarada ≠ estado operacional; container Up ≠ serviço homologado; não executar scripts de provisionamento ou alterar infra.
