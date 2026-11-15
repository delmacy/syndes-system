# I07 — Tailnet | auditoria de fonte e limites (2026-11-15 05:00 BRT)

## Base e isolamento
- Fonte autoritativa GitHub `main`: `1cf48cc0a1281017ac58f7b9b9747f663109e151` (consultada novamente imediatamente antes de criar esta branch).
- Branch exclusiva: `audit/i07-tailnet-source-boundary-20261115-0500`. Este arquivo é checkpoint de auditoria, **não** aprovação de runtime, implantação ou CI.
- Catálogo `catalog/work-units.json`: I07, `partial`, owner `infra/master-admin/check-tailnet-route.py`, subordinado documentalmente a I02. `maturity` não é aceite.
- Fronteira I06: Traefik/Docker HTTPS e middleware `syndes-tailnet-only@docker` são outra configuração, não coberta por esta verificação de Tailscale Serve.

## Contrato público versus implementação privada
- Interface CLI pública de fato no arquivo: `--mode free|active`, `--port` (default 9447), `--target` (somente `http://127.0.0.1:18085`); entrada JSON via stdin; saída `PASS:` ou `BLOCKED:`; códigos 0 ou 2. Não há manifesto de package/exports.
- Função Python interna `check(config, mode, port, target)`: `free` rejeita porta ocupada; `active` exige exatamente um hostname Web com sufixo `:9447`, `TCP[9447].HTTPS is True`, único handler `/`, proxy exato loopback e `AllowFunnel[hostname] != True`.
- O script não altera configuração, não chama Tailscale, não inicia serviço e evita imprimir hostname na saída CLI. JSON recebido é a única observação de estado; a origem/autenticidade do JSON não é verificada.
- Não há classes de domínio, controllers HTTP, eventos de domínio, tabelas ou migrations de propriedade I07 nesses arquivos. As rotas Tailscale Serve não são APIs de negócio.
- Dependências: biblioteca padrão Python (`argparse`, `json`, `sys`); configuração Tailscale Serve externa e serviço local Manager são pré-condições. Não atribuir ao checker autenticação de usuário, ACL Tailnet, TLS real, DNS ou disponibilidade de upstream.

## Testes existentes e limites
- `tests/platform/test-manager-tailnet-route.py` contém **sete métodos de teste** com fixtures e execução da CLI em subprocesso: porta livre/ocupada, alvo exato, coexistência com 9446, duplicidade, HTTP/Funnel, JSON inválido e não divulgação de hostname.
- Não executados nesta rodada: testes unitários, integração, CI, DevServer, curl/TLS, ACL, Docker, SQL, migrations ou homologação.
- A existência de assertions não comprova resultado verde no SHA-base, nem configuração ativa, nem autorização de rede.
- Observação de limite: o checker rejeita `AllowFunnel[hostname] is True`, mas não inspeciona política de ACL nem certificação de que o JSON provém do daemon correto; um `PASS` não deve ser apresentado como teste end-to-end de privacidade ou conectividade.
- O teste de coexistência 9446/9447 verifica apenas a estrutura de configuração sintética, não disputa real de porta.

## Divergências documentais e reconciliação
- `docs/subprojects/I07-tailnet/STATUS.md` e `REFERENCIA-TECNICA.md` ainda descrevem interfaces/testes como “A AUDITAR”; este checkpoint fornece o inventário verificável, sem editar as páginas de outro escritor.
- `chapters/04-contratos-e-dependencias-publicas.md` diz “A INVENTARIAR”; a CLI e as dependências acima já podem ser reconciliadas por equipe documental.
- O status `partial` do catálogo é compatível com código existente e ausência de validação operacional. Não promover a `verified` ou homologado por inspeção estática.

## Gates pendentes
1. Revisão documental do contrato CLI e fronteira I06/I07, com comparação da main atual antes de qualquer integração.
2. CI/teste isolado do checker com SHA e resultado registrados, se autorizado por fluxo próprio.
3. Evidência somente leitura da configuração Tailscale Serve realmente ativa, ACLs e acesso permitido/negado, sem expor hostnames ou segredos.
4. Confirmar owner do roteamento, certificado e origem do JSON; registrar implantação por ambiente, sem inferência a partir de fixtures.
5. Conciliar catálogo completo de 57 owners e novos owners encontrados, divergências Q07/Q08/G03 e SHA público do Pages; **não concluído nesta auditoria**.

**Estado:** fonte e contrato CLI identificados; testes presentes mas não executados; integração, operação, homologação e Pages não comprovados. Nenhum runtime ou configuração foi alterado.
