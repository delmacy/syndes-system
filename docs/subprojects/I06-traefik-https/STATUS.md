# I06 — Traefik HTTPS | STATUS

> **AUDITORIA TÉCNICA PARCIAL — não homologação operacional.** Fonte principal: `modules/whatsapp/deploy/devserver01-cutover.compose.yaml`; [evidência datada](../../evidence/checkpoints/I06-traefik-https-github-reconciliation-20261113.md).

## Onde paramos?
- Compose versionado de cutover WhatsApp contém dois routers, prioridades 110/2, entrypoint `web`, middleware referenciado `syndes-tailnet-only@docker` e destinos 8082/80.
- Checkpoint anterior `a393007` relata Traefik v3.6.25 e rede `infra-proxy` no DevServer01; evidência de observação, não teste de TLS/isolamento.
- Runbook aponta para manifesto local `/srv/syndes-lab/workspace.traefik.yaml` não localizado na auditoria anterior. Não presumir que a configuração histórica corresponda ao runtime atual.

## Eixos de validação
| Dimensão | Resultado | Limite |
|---|---|---|
| Documentação | Auditoria parcial I06 | Contratos Compose inspecionados; proprietário e runtime completo pendentes |
| Implementação | Configuração declarativa encontrada | Labels e manifests não comprovam aplicação |
| Integração | Não verificada | Sem testes de roteamento, certificados ou middleware |
| Operação | Containers identificados em checkpoint anterior | Sem TLS, firewall, isolamento ou rollback homologados |

## WBS
| ID | Estado | Evidência | Próximo gate |
|---|---|---|---|
| I06.DOC.01 | PARCIAL | Compose versionado, referência e oito capítulos | Revisão de escopo/owner |
| I06.SEC.01 | PENDENTE | Middleware somente referenciado por label | Teste de allowlist e negativas |
| I06.TLS.01 | PENDENTE | `entrypoints: web` no Compose | Confirmar TLS, redirects e certificados efetivos |
| I06.OPS.01 | PENDENTE | Runbook histórico e checkpoint de runtime | Confrontar origem de manifests e ingress efetivo |

## Continuidade
- Após I06, consultar catálogo e plano para próxima unidade realmente não auditada.
- Não alterar serviços, segredos, CI, rede ou ingress para atualizar esta documentação.

## Revisão de evidência 2026-11-15 (main `1cf48cc0`)
- Auditorias novas em branches independentes: `audit/i06-runbook-test-safety-20261115-0801` e `audit/i06-live-readiness-evidence-20261115-1903`; **não integradas ao main neste checkpoint**.
- Divergência documental I06-TEST-01: o runbook chama `npm run build` de teste seguro, embora `dist` seja servido por bind mount; build direto pode alterar artefatos visíveis. Correção editorial proposta nesta branch, sem execução.
- Divergência I06-NEW-01: `tests/live-readiness.mjs` aceita 401 **ou 403** em Inbox anônimo e sua mensagem de sucesso excede o alcance das verificações; não comprova Inbox autenticado nem isolamento de tenants.
- Evidência: fontes e scripts identificados; **testes não executados**, TLS/middleware efetivo, deploy atual, homologação e SHA público do Pages **não verificados**. Gates I06.SEC/TLS/OPS continuam pendentes.
