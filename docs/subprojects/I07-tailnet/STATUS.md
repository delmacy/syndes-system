# I07 — Tailnet | STATUS

> **AUDITORIA TÉCNICA PARCIAL — não homologação.** Fonte [check-tailnet-route.py](../../../infra/master-admin/check-tailnet-route.py); [checkpoint 2026-11-13](../../evidence/checkpoints/I07-tailnet-source-audit-20261113.md). Base: `main@05d46ca`.

## Onde paramos?
- O script Python verifica declarativamente uma rota privada Tailscale Serve dedicada ao Platform Manager. Não altera configuração nem revela hostname.
- Contrato de `check(config, mode, port=9447, target="http://127.0.0.1:18085")` inspecionado via GitHub. `free` rejeita porta ocupada; `active` exige HTTPS, rota única, proxy exato e ausência de Funnel público.
- Nenhum teste do script, configuração ativa, ACL, certificado, roteamento ou deploy foi comprovado nesta revisão.

## Eixos de estado
| Eixo | Estado | Limite |
|---|---|---|
| Documentação | Auditoria parcial | Código e contrato inspecionados |
| Implementação | Fonte Python encontrada | Sem execução de testes comprovada |
| Integração | Não verificada | Sem fixtures ou integração I06 |
| Operação | Não verificada | Sem Serve/ACL/TLS/Manager ativo comprovados |

## WBS
| ID | Estado | Gate |
|---|---|---|
| I07.DOC.01 | PARCIAL | Revisão de owner, capítulos e contrato |
| I07.TEST.01 | PENDENTE | Fixtures de casos positivos e negativos |
| I07.SEC.01 | PENDENTE | ACL, Funnel e negativas de acesso |
| I07.OPS.01 | PENDENTE | Configuração ativa, HTTPS e destino real |

## Próximo passo
Conferir a [referência técnica](REFERENCIA-TECNICA.md), [operação](OPERACAO.md) e [checkpoint](../../evidence/checkpoints/I07-tailnet-source-audit-20261113.md). Nenhuma mudança em runtime ou permissões foi autorizada.
