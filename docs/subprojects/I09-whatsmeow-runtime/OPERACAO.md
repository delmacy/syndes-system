# I09 — Whatsmeow runtime | Operação

> **COMPONENTE TÉCNICO DO P03 — WHATSAPP.** Este documento histórico I09 permanece acessível para WBS, commits e links antigos. O gateway Go/Whatsmeow faz parte de [P03 — WhatsApp](../P03-whatsapp/README.md), com [Referência técnica](../P03-whatsapp/REFERENCIA-TECNICA.md) e [Operação](../P03-whatsapp/OPERACAO.md) centrais. Não representa outro módulo de produto.


> **ÍNDICE DE FONTES, NÃO RUNBOOK HOMOLOGADO.** Não executar migrations, alterar permissões ou ativar workers apenas com esta página.

## Estado operacional e evidências

- [STATUS](STATUS.md): nível de validação, bloqueios, testes, ambiente e SHA.
- [SPRINT](SPRINT.md): incremento autorizado e checkpoints, quando existentes.
- [Evolução](EVOLUCAO.md): workpackages e dependências; nenhum item é concluído por estar planejado.
- [Histórico](HISTORICO.md): commits de código e documentos.
- [Workflows GitHub](../../monitoramento/README.md): resultado CI geral, não estado operacional do módulo.

## Fontes e contratos

- [Código/artefato do módulo](https://github.com/delmacy/syndes-system/tree/main/modules/whatsapp/gateway) — `modules/whatsapp/gateway`.
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

## Evidência incremental do callback — 15/11/2026

- [Auditoria de divergência I09](https://github.com/delmacy/syndes-system/blob/audit/i09-callback-doc-drift-20261115-2055/docs/audits/I09-CALLBACK-DOCUMENTATION-DRIFT-20261115-2055.md) (branch de auditoria não integrada nesta revisão): a fonte Node declara `POST /api/v1/internal/whatsapp/events/:tenantId`; o README P03 de 02/11 que negava o callback é histórico. A declaração no código **não** comprova registro da rota no processo em execução, entrega Go→Node, autenticação funcional ou homologação.
- O worker de despacho condiciona a inicialização do timer a `WHATSAPP_DISPATCH_ENABLED=true`; o valor efetivo no ambiente não foi verificado. O store instanciado no serviço inspecionado não utiliza o bridge transacional opcional; não atribuir garantias desse bridge ao caminho ativo.
- **Gates pendentes, sem execução nesta revisão:** verificar o envelope v1 entre Go e Node, respostas negativas e isolamento entre tenants em ambiente isolado; vincular resultados de testes e CI ao SHA; confirmar registro da rota e integração operacional por evidência autorizada. Migrations declaradas não equivalem a migrations aplicadas.
- **Restrição:** esta página é orientação documental; não autoriza habilitar worker, executar SQL, alterar segredo, realizar deploy ou acionar ambiente de produção.
