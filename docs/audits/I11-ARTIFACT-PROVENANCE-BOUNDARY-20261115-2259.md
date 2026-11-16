# I11 — Release e Rollback: proveniência e gate de artefatos (2026-11-15)

- Fonte GitHub MCP: `main@1cf48cc0a1281017ac58f7b9b9747f663109e151`, verificado por comparação idêntica antes da criação da branch. Owner I11 no catálogo: `infra/master-admin/homolog-deploy.sh`, maturidade `partial`. Complementa `I11-RELEASE-ROLLBACK-SOURCE-AUDIT-20261114-1155.md`; não substitui nem edita checkpoints concorrentes.
- Contrato público: `docs/engineering/PLATFORM-MANAGER-RELEASE.md` exige CI verde, duas builds independentes, healthchecks, rollback comprovado e homologação real; explicitamente declara implantação bloqueada. Contrato privado: `homolog-deploy.sh`, `infra/master-admin/compose.yaml`, Dockerfiles API e frontend runtime.

## Divergências e fronteiras verificadas em fonte

1. **I11-PROVENANCE-02 — duas proveniências no mesmo release:** `homolog-deploy.sh` aceita `CI_ARTIFACT_MANIFEST.json.git_commit` diferente de `HEAD` quando o diff nos caminhos frontend enumerados é vazio; constrói a API localmente a partir do checkout `HEAD` via `docker build`. Não existe verificação de manifesto de artefato CI da API nem comparação de conteúdo/hash da API com o SHA de build aprovado. Consequentemente o par frontend/API pode ter origens de commit distintas; isso não prova defeito funcional, mas impede declarar release integralmente rastreável a um único SHA aprovado.
2. **I11-PROVENANCE-03 — manifesto sem integridade de payload comprovada:** o script verifica existência do manifesto e `index.html`, lê `git_commit` e verifica ancestralidade/existência do commit e diff restrito a fontes frontend; não calcula checksum do conteúdo de `artifacts/web-dist` nem verifica assinatura/atestado do bundle contra CI. O nome `CI_ARTIFACT_MANIFEST` não é prova criptográfica do artefato.
3. **I11-GATE-04 — saúde parcial:** o Compose declara healthchecks de API e web e a dependência web exige API saudável na inicialização. Porém o script aguarda somente `curl` HTTP 2xx da raiz web local, valida roteamento Tailnet por configuração e grava `deployed-head`; não executa a matriz de login OIDC, 401/403, autorização e rollback exigida pelo documento público. O resultado do script é deploy técnico condicional, não homologação.
4. **I11-ROLLBACK-05 — recuperação incompleta:** o trap remove a stack isolada em erro e eventualmente desliga a rota própria; não recupera artefato anterior nem mede RTO/RPO. A gravação `deployed-head` registra HEAD do checkout, não um digest das duas imagens implantadas.

## Fronteiras e execução

- Não há APIs HTTP de negócio, eventos de domínio ou migrations definidos pelo script I11; `pg_authid` e `platform_operator_access` são apenas consultas de pré-condição ao Control DB. APIs e schema do Manager pertencem a A05/C01, não foram integralmente auditados aqui.
- Inspeção estática por GitHub MCP; nenhum teste unitário/integrado/E2E, Docker, build, SQL, migration, CI, workflow, deploy, rollback ou DevServer executado. Sem leitura de segredos. Testes de CI, estado operacional e homologação **não comprovados**.
- Nenhum arquivo de produto alterado; apenas este checkpoint. Não fazer merge sem revisão independente. Não atribuir estado `verified` ou resolver divergências globais. Catálogo das 57 unidades e owners extras ainda requer reconciliação; SHA público do GitHub Pages não verificado.
