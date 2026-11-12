# P03 — WhatsApp | Operação

> **ÍNDICE DE FONTES, NÃO RUNBOOK HOMOLOGADO.** Não executar migrations, alterar permissões ou ativar workers apenas com esta página.

## Estado operacional e evidências

- [STATUS](STATUS.md): nível de validação, bloqueios, testes, ambiente e SHA.
- [SPRINT](SPRINT.md): incremento autorizado e checkpoints, quando existentes.
- [Evolução](EVOLUCAO.md): workpackages e dependências; nenhum item é concluído por estar planejado.
- [Histórico](HISTORICO.md): commits de código e documentos.
- [Workflows GitHub](../../monitoramento/README.md): resultado CI geral, não estado operacional do módulo.

## Fontes e contratos

- [Código/artefato do módulo](https://github.com/delmacy/syndes-system/tree/main/modules/whatsapp) — `modules/whatsapp`.
- [Contratos públicos](../../standards/CONTRATOS-PUBLICOS.md).
- [Regras de rastreabilidade](../../standards/FONTES-DE-VERDADE-E-RASTREABILIDADE.md).
- **Runbook específico:** não verificado neste inventário. Não criar comandos de ambiente por inferência.

## Operações orientadas por agentes

- [Projeção / Planejamento](PROJECAO.md)
- [Implementação](IMPLEMENTACAO.md)
- [Alteração rápida](ALTERACAO.md)
- [Entrada de propostas](updates/README.md)

## Gates para operação real

1. Conferir fonte, tenant/org/workspace, ambiente, SHA e autorização explícita.
2. Validar identity/service grants e ownership de banco.
3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.
4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.
5. Registrar resultado e evidência em STATUS, sem confundir merge com deploy ou aceite.

## Operação do gateway Whatsmeow (componente I09)

O sidecar Go pertence ao módulo **P03 WhatsApp**. Seu código fica em `modules/whatsapp/gateway/whatsmeow/`, com [README técnico no repositório](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/gateway/whatsmeow/README.md).

O processo gerencia sessões e a comunicação WhatsApp; a API TypeScript atende aos contratos de negócio. A troca entre processos precisa de autenticação interna e callbacks protegidos. O armazenamento de sessões do sidecar é separado dos dados de negócio do Tenant DB. Não expor a API do sidecar diretamente à internet.

[Documentos históricos de operação I09](../I09-whatsmeow-runtime/OPERACAO.md) · [WBS e pendências I09](../I09-whatsmeow-runtime/EVOLUCAO.md).

**Regra de operação:** o corte do projetor, service grants, restore e deploy exigem gates próprios; esta alteração documental não habilita workers ou conexões.
