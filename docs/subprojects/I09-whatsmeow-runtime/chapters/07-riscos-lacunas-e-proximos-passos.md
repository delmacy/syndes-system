# 07 — Riscos, lacunas e próximos passos

> **I09 / Whatsmeow runtime — auditoria documental parcial (13/11/2026).** Esta página registra limites de evidência; não certifica execução, implantação nem homologação. Componente técnico de [P03 — WhatsApp](../../P03-whatsapp/README.md), não um produto independente.

## Evidência e limites

A revisão estática da branch de origem `docs/i09-followup-plan-20261113-1518` aponta os arquivos `modules/whatsapp/gateway/whatsmeow/main.go`, `gateway.go`, `outbound.go`, `main_test.go` e `README.md` como fontes examinadas. O [STATUS](../STATUS.md) e a [referência técnica](../REFERENCIA-TECNICA.md) registram o que foi encontrado; a leitura não executou Go, PostgreSQL, WhatsApp, rede, autenticação end-to-end ou deploy. O SHA de fonte documentado é `a1754ccc`; reconciliação com commits posteriores é obrigatória antes de aceitar o conteúdo como atual.

## Matriz de riscos e provas pendentes

| Risco ou lacuna | Estado de evidência | Prova necessária |
|---|---|---|
| Autorização por conta e isolamento de tokens | Código/testes identificados, não executados nesta auditoria | Testes Go e integração de autenticação com contas distintas |
| Persistência, sessões e recuperação | Implementação declarada em fonte, runtime não verificado | Integração PostgreSQL isolada, restart e restore documentados |
| Idempotência e envio incerto | Caminhos de código identificados | Testes de concorrência, retries e ausência de replay indevido |
| Quota de 40 envios/minuto por conta | Regra declarativa observada, eficácia não comprovada | Teste de carga concorrente por conta e isolamento |
| Callbacks e envelopes | Testes definidos, sem resultado desta revisão | Contratos de callbacks, erros e compatibilidade com P03 |
| HTTPS, operação e observabilidade | Não verificados | Evidência de ambiente-alvo, smoke e logs sem segredos |
| Documentação navegável | Páginas temáticas versionadas | MkDocs estrito, checagem de links, registry e renderização real |
| Homologação do produto | Não verificada | Aceite explícito do owner P03 e Product Gate independente |

## WBS e ordem de validação

As referências de trabalho identificadas são `40.04`, `50.05`, `50.06` e `95.05`; ver [capítulo 06](06-wbs-marcos-e-aceite.md) e [EVOLUCAO](../EVOLUCAO.md). Nenhuma deve ser marcada DONE somente por esta documentação.

1. Comparar o código de P03/I09 com o `main` atual e reconciliar contratos e ownership.
2. Executar os gates documentais em ambiente isolado, com comandos, resultados e SHA registrados.
3. Executar os testes Go/contrato e integração em ambiente descartável autorizado, sem modificar runtime de produção.
4. Obter revisão do owner P03, registrar evidências operacionais separadas e somente então avaliar homologação.
5. Verificar publicação Pages por SHA do commit integrado; PR ou commit em branch não comprovam publicação.

**Witness registry:** nenhuma entrada nova é autorizada por esta página; exigir símbolo, arquivo, linha e extração reproduzível. Não converter texto descritivo em testemunha AST.
