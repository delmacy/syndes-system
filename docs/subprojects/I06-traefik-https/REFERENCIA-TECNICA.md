# I06 — Traefik HTTPS | Referência técnica

> **Inventário declarativo auditado parcialmente** sobre `2b808681`; não há aceite de HTTPS ou segregação de rede.

## Stack e ownership
- Tipo: roteamento reverso declarativo em Traefik/Docker; owner documental I06, vinculado à hospedagem I02.
- Fonte real de configuração versionada: `modules/whatsapp/deploy/devserver01-cutover.compose.yaml`; `modules/whatsapp/deploy/README.md`; documentação operacional histórica: `docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md`.
- A configuração global efetivamente carregada pelo Traefik não foi localizada/validada neste gate.

## Contratos e serviços internos
| Router declarado | Match | Prioridade | Entrypoint | Middleware referenciado | Porta do destino |
|---|---|---:|---|---|---:|
| `syndes-core-whatsapp-v2` | Host + PathPrefix(`/v1/` ou `/modules/`) | 110 | `web` | `syndes-tailnet-only@docker` | 8082 |
| `syndes-workspace-whatsapp-v2` | Host | 2 | `web` | `syndes-tailnet-only@docker` | 80 |

Ambos declaram `traefik.enable=true` e `traefik.docker.network=infra-proxy`; `infra-proxy` e outras redes são externas ao Compose. A prioridade separa caminhos de API e fallback Workspace **somente se** esses routers forem carregados com as regras esperadas. `web` não constitui prova de TLS; TLS, `websecure`, redirects, certificados e política real de ingresso precisam de verificação independente.

## Classes, métodos, API, eventos e dados
- I06 é componente de infraestrutura **declarativo**: nenhum pacote TypeScript, API de negócio, classe/método exportado, consumidor de eventos ou migration SQL próprio foi comprovado nas fontes auditadas.
- Destinos HTTP internos pertencem ao Core Host e Workspace, não criam endpoints novos de I06. Não atribuir tabelas do Tenant DB ou Control DB a este componente.
- O testemunho é de **campo de manifesto/roteador**, não testemunha AST de classe; o registry de símbolos permanece inalterado intencionalmente.

## Fronteiras públicas/privadas
- A publicação do proxy depende de Docker, traefik provider, DNS/host, rede, entrada 80/443, autenticação/autorização dos serviços a jusante e middleware existente.
- Não confundir host acessível, certificado aceito ou HTTP 200 com autorização correta do backend.

## Evidências e limites
- [Checkpoint GitHub-first](../../evidence/checkpoints/I06-traefik-https-github-reconciliation-20261113.md).
- [Operação e gates](OPERACAO.md); [capítulos de contratos](chapters/04-contratos-e-dependencias-publicas.md) e [arquitetura](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md).
