# I11 — Release e Rollback: auditoria estática de fonte (2026-11-14)

- Base canônica verificada: `main@1cf48cc0a1281017ac58f7b9b9747f663109e151` (compare identical antes da escrita).
- Owner no catálogo: `I11`, `infra/master-admin/homolog-deploy.sh`, maturidade `partial`. Auditoria restrita ao script, `catalog/work-units.json`, `README.md`, `docs/engineering/PLATFORM-MANAGER-RELEASE.md` e `docs/engineering/MAINLINE-CI-POLICY.md`.

## Contratos e fonte

- CLI aceita exclusivamente `--preflight` e `--apply`; diretório de checkout aprovado e dependências Docker, jq, Tailscale e Python obrigatórios. Preflight consulta estado de containers, redes, role/owner no Control DB, OpenBao, permissões de arquivos de segredos, manifesto do artefato web e configuração Tailnet. Não é um teste isolado executável sem infraestrutura real.
- `--apply` gera configuração runtime, constrói imagens locais da API e do frontend, sobe somente o Compose Manager, testa a resposta HTTP local, configura Tailscale Serve privado 9447, grava `deployed-head` e instala trap de limpeza em caso de erro.
- Proteções visíveis: recusa sobrescrever rota 9447 existente, exige rede interna e owner ativo, compara fonte frontend ao SHA do artefato CI, exige checkout sem mudanças rastreadas, não altera os handlers 8443/9443/9444 intencionalmente.
- Fronteiras: script de operação local, não endpoint HTTP nem public API de negócio. Não publica eventos de domínio; não define schemas ou migrations. Lê `platform_operator_access` e `pg_authid`, mas não aplica SQL/migration. Contratos de autenticação/API do Manager pertencem a A05/A02 e não foram revalidados nesta etapa.

## Lacunas e riscos para revisão

1. A verificação de proveniência do artefato CI cobre caminhos do **frontend**, não comprova por si só um artefato imutável e validado para a **API**: a API é construída localmente no apply. A igualdade do SHA do manifesto com o HEAD também não é exigida; há comparação limitada a caminhos do frontend. Revisar política de release antes de homologar.
2. O trap em erro executa `docker compose ... down --remove-orphans` no stack Manager; isso é **cleanup de deploy malsucedido**, não demonstra rollback de versão anterior, restauração de serviço/dados nem RTO/RPO.
3. `--preflight` é descrito como sem mudanças e não possui comandos intencionais de escrita, mas acessa dados operacionais sensíveis e exige root; não foi executado. Não assumir que validações externas ou chamadas de rede foram observadas.
4. A verificação de HTTPS/Tailnet operacional é delegada ao checker I07 e à configuração do host; não se prova TLS real, isolamento de rede, login OIDC, 401/403 ou homologação por inspeção estática.
5. A política documental registra gates de CI e release; nenhum resultado atual de CI por SHA, artefato, deployment ou GitHub Pages foi consultado/confirmado nesta auditoria.

## Evidência e limites

Fonte lida diretamente por GitHub MCP no SHA base acima. Nenhum teste executado; nenhum DevServer acessado; nenhum Docker, SQL, migrations, runtime, secrets, CI/workflow ou deploy alterados. Nenhuma inferência de produção ou homologação. O catálogo tem 57 owners e esta auditoria é somente uma unidade; divergências globais e publicação Pages permanecem abertas. Este checkpoint não altera o estado `partial` nem concede aprovação para merge.
