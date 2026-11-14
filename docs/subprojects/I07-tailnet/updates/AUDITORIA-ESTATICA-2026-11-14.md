# I07 Tailnet — reconciliação estática parcial (2026-11-14)

**Base GitHub:** `main@1cf48cc0a1281017ac58f7b9b9747f663109e151`. **Fonte:** `infra/master-admin/check-tailnet-route.py`, blob `d51f6e69f2b0a04670eaf7c7119950fa53da1452`. **Predecessor:** PR #111, checkpoint `36e9707`, 24 commits atrás do main consultado. Esta nota não substitui o dossiê canônico.

## Evidência observada no código

- `check(config, mode, port=9447, target="http://127.0.0.1:18085")` valida forma básica dos mapas `TCP` e `Web`; `main()` recebe JSON via stdin e retorna código 0 ou 2.
- Modo `free`: rejeita porta 9447 se presente em `TCP` ou em host `Web` terminado em `:9447`.
- Modo `active`: exige exatamente um host `Web` na porta, `TCP["9447"]["HTTPS"] is True`, handler único `/`, proxy exato para loopback 18085 e `AllowFunnel[hostname] != True`.
- O script não imprime hostnames e limita o target aceito no CLI. É uma checagem estática da configuração fornecida, não prova de conectividade, autenticação ou implantação.

## Lacunas e riscos a revisar

1. `check()` não valida o formato integral do hostname nem todas as chaves inesperadas nos objetos `TCP`, `Web` e `AllowFunnel`.
2. A correspondência `hostname.endswith(":" + port_key)` depende da representação do JSON Serve; confirmar o contrato com fixtures reais/sanitizadas e versões suportadas do Tailscale.
3. `AllowFunnel` é consultado somente para o hostname correspondente; não há demonstração de inspeção de políticas externas ou ACLs.
4. O script não executa requisições HTTPS, não prova certificado, reachability, identidade, health do Manager ou ausência de exposição por outros caminhos.
5. Não foram executados testes, gates MkDocs/links/registry, revisão de ownership, homologação, deploy ou verificação do SHA público do Pages nesta reconciliação.

## Estado e continuidade

**Fonte presente: SIM. Testes aprovados: NÃO COMPROVADOS. Implantado/homologado: NÃO COMPROVADO.** Sem witnesses novos. Reconciliar esta evidência com o PR #111 e os documentos `STATUS.md`, `REFERENCIA-TECNICA.md`, `OPERACAO.md`, oito capítulos temáticos e blueprint/WBS, preservando alterações concorrentes. Não integrar esta nota isolada como auditoria concluída.
