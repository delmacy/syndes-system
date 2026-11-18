# IAM-07D4 — Engine real do Service Management sob epoch transacional

**Data:** 2026-11-18. **Estado:** PR candidata, CI ainda pendente. **PRODUCTION_GATE=BLOCKED**.

## Garantia restrita, mas concreta

A etapa IAM-07D3 fechou o caminho de atribuição na Inbox. A etapa D4 conecta a operação existente de **avanço de etapa de atendimento** do módulo Service Management ao `Iam07dRevokeFirstPilot.execute` com o mesmo `TenantTransaction` pinned. Não reproduz SQL da engine de Service no Core Host.

`ServiceFunnelService.advance` e `ServiceFunnelService.advancePinned` agora chamam **a mesma função privada** `advanceMutation(ctx,input,tx)`. A nova variante `advancePinned` **não abre outra transação**: recebe a transação validada `PINNED_TENANT_TRANSACTION`, reaplica `CoreKernel.executeModule`, membership SQL com `FOR SHARE`, configuração trusted `syndes.service_actor_id` e SQL de versão CAS da própria engine. A variante histórica `advance` preserva a forma original de execução no módulo (kernel + tenant provider transaction).

`apps/core-host/src/iam07d-service-funnel-business-pilot.ts` é um adaptador de **laboratório**, não importado pelo Host operacional. Só emite ticket para `service.funnel.operate` e exige `funnelId` válido. Dentro de `execute`, verifica que a attendance realmente pertence ao mesmo `funnelId` da autorização fina e trava a linha de atendimento `FOR NO KEY UPDATE` antes de invocar o método original Service `advancePinned`.

## O que o teste verifica

`modules/service-management/test/service-funnels-pg17.test.mjs` é estendido no job `Regression / service-management` do CI único. O job inicia PostgreSQL 17 descartável, instala o SQL002 físico e a migration candidata 008 **somente no banco de CI**, mantém a suite inteira Service já existente e adiciona ator de identidade UUID para o teste isolado.

1. Abre atendimento real usando a própria engine Service e cria fence por capability específica.
2. Nega funil divergente, política fina ausente e versão inválida.
3. Executa avanço adjacente real, com auditoria trigger `stage_changed` **uma única vez** e CAS de versão.
4. Nega avanço duplicado e confirma ausência de uma segunda auditoria.
5. Emite ticket válido, revoga `epoch` na tabela tenant local e comprova que mesmo com a política FGA simulada retornando ALLOW, o método `advancePinned` não executa nem altera stage/auditoria.
6. Exige marcador `IAM07D4_PG17_REAL_SERVICE_FUNNEL_EPOCH_AUDIT_PASS` após execução real, mais `Syndes CI Gate` central verde.

A **política específica e a admission Keycloak do teste Service são portas simuladas**, mas o efeito Service, locks, audit trigger, membership e PG17 são reais. O JWT humano real, a organização live e o modelo FGA granular foram validados separadamente na prova IAM-07D2/07D3. Não alegar que esta suíte é E2E com o mesmo token Keycloak até integrar tudo no mesmo teste.

## Pendências que impedem produção

- O Service não está ativado no Core Host; `main.ts` não importa os pilotos, `modules.json` não instala um novo plugin de negócio.
- O fluxo de **todas** as operações de atendimento (`assign`, `transferTeam`, `close`, `open`) ainda precisa aplicar o mesmo requisito fine-grained em uma configuração operacional revisada; apenas `advancePinned` é comprovado aqui.
- A aplicação de SQL002 permanece obrigatória; multi-workspace produtivo só após migração dedicada.
- Alterações diretas em Keycloak ou OpenFGA fora do canal tenant-first **não fazem lock no banco**, nem a auditoria do catálogo de tuples FGA é obrigatória para outros administradores. Reconciliação fora de banda e restrição dos próprios grants administrativos são pré-condições do IAM-09.
- A verificação externa Keycloak/OpenFGA antes de começar o efeito não é atomicamente conectada ao COMMIT tenant. A garantia de ordem vem do canal tenant-first quando este é o único escritor autorizado, que ainda precisa ser operacionalmente imposto.
- Não há backup/restore real de staging com rollback, load/soak multi-host, deploy, alteração de realm ou credentials, nem aceite do Product Gate.

**Resultado permitido em CI verde:** autorizar **mais implementação e E2E integrado**, nunca produção; `PRODUCTION_GATE=BLOCKED`.

Rastreamento: Issue #160 e WBS IAM.
