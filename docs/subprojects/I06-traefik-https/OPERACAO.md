# I06 — Traefik HTTPS | Operação

> **Diagnóstico somente leitura; runbook NÃO homologado.** Documentar ingress não autoriza alterar portas, labels, firewall, middlewares ou serviços.

## Estado observado
- Checkpoint local `a393007` (2026-11-13) reportou container Traefik v3.6.25 em execução na `infra-proxy`, portas 80/443 publicadas e quatro containers com labels. Isso **não** comprova exposição Internet nem isolamento Tailnet.
- Compose GitHub de cutover WhatsApp declara dois routers no entrypoint `web` e referencia `syndes-tailnet-only@docker`. Não foi comprovada a definição/eficácia do middleware ou TLS end-to-end.
- Runbook `WORKSPACE-DEVSERVER01-RUNBOOK.md` lista arquivos locais em `/srv/syndes-lab` não identificados no checkpoint; revisar a validade histórica antes de qualquer operação.

## Gates de aceite por evidência
1. Inspecionar a configuração ativa do proxy e a procedência de entrypoints, routers e middlewares, filtrando credenciais e caminhos sensíveis.
2. Confirmar destino das portas 80/443 e certificado/hostname/redirect por teste com validação TLS; registrar data, ambiente e resultado.
3. Validar acesso autorizado pela Tailnet e **negação por origem não autorizada** (sem contornar firewall ou abrir portas).
4. Conferir roteamento API `/v1/`, `/modules/` e Workspace, prioridades, códigos esperados e downstream authorization. HTTP 200 da página estática não prova autorização de dados.
5. Revisar plano de rollback documentado para cutover, dependências e impacto nos callbacks; não executar rollback sem janela/autorização específica.
6. Registrar evidências no STATUS e checkpoint por revisão e ambiente. Sem evidência, permanecer pendente.

## Registros
- [SPRINT — acompanhamento do incremento](SPRINT.md): planejamento, não aceite operacional.
- [Projeção](PROJECAO.md) · [Implementação](IMPLEMENTACAO.md) · [Alteração](ALTERACAO.md): instruções de agentes, não procedimentos aprovados de produção.
- [STATUS](STATUS.md) · [Referência técnica](REFERENCIA-TECNICA.md) · [Checkpoint](../../evidence/checkpoints/I06-traefik-https-github-reconciliation-20261113.md) · [Plano geral](../../blueprint/PLANO-ATUALIZACAO-MODULOS.md).
- Não usar valores de `env_file`, tokens, certificados privados ou dumps no relatório público.

## Segurança de execução e leitura de resultados — 15/11/2026
- **Não executar `npm run build` no DevServer01 como teste somente leitura.** O runbook documenta `dist` servido por bind mount; o build pode modificar os arquivos publicados de forma não atômica. Executar validação de build apenas em ambiente isolado, com artefatos descartáveis.
- Testes unitários, lint e browser devem ter dependências/efeitos revisados e ser executados em ambiente isolado antes de declarar aprovação. `test:smoke` pode usar origem Tailnet live e senha demo local; não o executar nesta auditoria.
- Diferenciar: acesso anônimo negado (401/403), sessão autenticada, autorização tenant, entrega de mensagens e operação homologada. `PASS` de readiness não substitui essas evidências.
- Pendentes: configuração Traefik carregada, cadeia TLS, allowlist negativa, roteamento efetivo, rollback e gates documentais por SHA.
