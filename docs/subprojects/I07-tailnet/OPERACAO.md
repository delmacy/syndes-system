# I07 — Tailnet | Operação

> **Runbook de verificação planejada, não procedimento homologado.** Não aplicar Tailscale Serve, alterar ACL, ingress ou certificados como parte desta auditoria.

## Inventário e proveniência
- [STATUS](STATUS.md), [referência técnica](REFERENCIA-TECNICA.md), [checkpoint de código](../../evidence/checkpoints/I07-tailnet-source-audit-20261113.md).
- Fonte: `infra/master-admin/check-tailnet-route.py`, verificador somente leitura de JSON estruturado. O script não comprova configuração efetiva nem o estado do Manager.
- O [runbook histórico Workspace](../../engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md) registra URLs/portas de outro fluxo, não prova de I07 ativo hoje.

## Gates seguros pendentes
1. Em ambiente isolado, alimentar o script com JSON de fixture **sem dados reais** para casos `free` e `active`; registrar SHA, entrada sintética e código de saída.
2. Inspecionar configuração efetiva Tailscale Serve em ambiente autorizado, sem publicar hostnames ou tokens.
3. Validar HTTPS e negativa de acesso não autorizado, ACL e ausência de Funnel público; correlacionar com I06 sem presumir equivalência.
4. Confirmar que o proxy aponta ao Manager correto e que a rota não substitui serviço existente.
5. Registrar evidências, rollback aprovado e owner antes de qualquer promoção operacional.

## Proibições neste incremento
Nenhuma alteração de runtime, DNS, firewall, ACL, Docker, segredos, migrations, grants ou serviços. Merge de documentação não constitui deploy.
