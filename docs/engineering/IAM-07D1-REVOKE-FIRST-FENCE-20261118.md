# IAM-07D1 — Revoke-first monotonic epoch e fence transacional (candidato)

**Data:** 2026-11-18. **Estado:** IAM-07D1 **integrado na main e testado no laboratório real**. PR [#175](https://github.com/delmacy/syndes-system/pull/175), merge `1f4d2bd95d64f8cce85365c1b8a6570d5a6e643b`, CI [44304717576](https://github.com/delmacy/syndes-system/actions/runs/44304717576): **24/24 jobs aprovados**, inclusive `Syndes CI Gate`. **PRODUCTION_GATE=BLOCKED**.

## Problema sem falsa garantia

Keycloak Organizations e OpenFGA são externos à transação PostgreSQL tenant; não há atomic commit entre eles e os efeitos Inbox/Service. Um check remoto antes de escrever não impede que o operador revogue direitos em outro sistema logo depois. Este incremento define um protocolo **somente para revogações encaminhadas pelo serviço confiável**, em que o estado de negação no PostgreSQL tenant se torna o ponto de linearização. Se a revogação é iniciada fora do protocolo, não existe garantia equivalente: isso é um **bloqueio de integração/segurança** e não deve ser mascarado.

## Protocolo com ordem explícita

1. O caller que tenta operar `inbox.conversation.claim`, `inbox.conversation.transfer` ou `service.funnel.operate` obtém admissão contextual válida (JWT assinado, Keycloak Org live, módulo ENABLED, link Control, escopo SQL 002). Além disso, deve obter um **ALLOW independente da política específica para a capability exata**. Nenhum FGA legado `inbox:assignment/write`, `inbox:messages/write` ou `service:attendances/write` é aceito como substituto; não há novas tuples FGA provisionadas nesta PR.
2. A tabela candidata `platform_iam_capability_fences` no PostgreSQL tenant mantém `(tenant, org, workspace, principal, capability, epoch, state)`. **Ausência de linha, permissão exata ausente, epoch antigo ou state revoked resultam em DENY**. O ticket efêmero é criado no backend e não é reaproveitável por clone/JSON.
3. O método `execute` usa o `TrustedTenantTransactionProvider` e `PINNED_TENANT_TRANSACTION` já existentes. Revalida `epoch`, membership org/workspace e status de ambos, em `SELECT ... FOR SHARE OF f,w,o,om,wm` e mantém o lock até o **COMMIT ou ROLLBACK do mesmo efeito e auditoria**. Chamar uma operação externa em outra transação invalidaria a garantia; a implementação futura precisa usar exatamente esse `tx`.
4. Para revogar pelo protocolo, `revoke` muda `active → revoked` e `epoch → epoch+1` **primeiro** no tenant DB, com CAS. A revogação espera efeitos já autorizados que estejam segurando o lock; após o COMMIT dela, nenhuma transação nova consegue usar o epoch anterior.
5. **Somente depois** do COMMIT tenant, registra `platform_iam07d_revocation_receipts` no Control separado. Se Control cair, a negação tenant permanece e é possível repetir a **mesma** `operationId` para reconciliar o recibo; operação diversa/stale falha. Esse recibo é dado de reconciliação — **não é um transactional outbox completo com dispatcher/receipts de entrega**.
6. As tabelas ainda são migrations **manuais candidatas**: `modules/organizations/sql/008_iam07d_revoke_first_candidate.sql` e `infra/postgres/bootstrap/control-iam07d-revocation-receipts.schema`. Não fazem parte de migrations automáticas de plugin nem alteram bancos operacionais. A instalação tenant aborta se SQL 002 físico estiver ausente.

## Evidências da bateria real

`apps/core-host/test/iam07d-revoke-first-pg17.test.mjs`, integrado no job existente `Regression / host`, cria **dois bancos PG17 separados** no container de CI: Control e tenant. Exercita:

- Ticket próprio, cap exata, recusa de impersonação e de objeto clonado.
- Transação de negócio primeiro: revogador fica bloqueado, operação COMMITa e só então revogação retorna.
- Revogação primeiro: operação aguarda o lock e, após COMMIT da revogação, nega sem efeito nem auditoria.
- Control indisponível depois do COMMIT tenant: a capability permanece negada, tentativa com outro ID falha, retry do mesmo `operationId` reconcilia sem incrementar epoch.
- Isolamento de `claim`, `transfer` e `funnel` no mesmo tenant. Sem reutilizar privilégios coarse.
- Marcadores **confirmados** no job `Regression / host`, em PostgreSQL 17 real descartável: `IAM07D_PG17_REVOKE_FIRST_EPOCH_LOCK_CONTROL_OUTAGE_REPLAY_PASS` e `IAM07D_FINE_CAPABILITY_NO_COARSE_GRANT_FALLBACK_PASS`; execução central 44304717576 **24/24**.

## Restrições que continuam BLOCKER

- **Não foi implementado um mecanismo que capture automaticamente revogação feita diretamente no console Keycloak ou OpenFGA.** Não existe atomicidade entre as fontes nem garantia de tempo de propagação; o protocolo exige que a revogação administrativa passe pelo fence tenant antes de alterar grants remotos.
- A interface `SpecificIam07dPolicy` é uma **porta estrita sem adapter OpenFGA de produção e sem tuples novas**. Testes desse incremento usam uma implementação simulada para confirmar comportamento; não constitui autorização fina real.
- O próprio `Iam07dRevokeFirstPilot` não está integrado aos controllers de Inbox/Service, nem o ticket/callback passa pelos serviços de negócio operacionais; a prova transacional usa efeito SQL sintético no mesmo banco.
- Recibo Control não é o Event Bus/Transactional Outbox já definido, não está conectado a consumidores IAM, não tem reconciliação automatizada, logs de tentativas ou `dead-letter`. Erro no Control após revoke mantém DENY e exige reconciliação.
- Não existe recuperação automática para reativar privilégios. `active` em fixture CI **não equivale a concessão FGA** e não há reabilitação operacional segura até o rollout formal.
- Multi-org SQL002 permanece ativo; sem implantação de schema/role, frontend, realm, secrets, OpenBao, FGA grants, rede operacional ou CD manual.
- IAM-09 demanda E2E completo sobre a rota de negócio com JWT real, FGA de capacidades específicas, controle de acesso da role SQL, reset/reconciliação, restore de staging real, rollback, desempenho sob carga e aceite do Product Gate. **PRODUCTION_GATE=BLOCKED**.

## Próximo passo — IAM-07D2

Ligar a nova porta `SpecificIam07dPolicy` a uma decisão independente efetiva do OpenFGA para cada ação, com modelo/relações versionadas e testes negativos contra coarse grant; criar um serviço de revogação administrativa que **fence primeiro** e só depois execute alterações Keycloak/FGA com outbox idempotente e reconciliação. Testar efeitos reais `claim/transfer/funnel` com o mesmo `tx` e rejeitar execução via controller que contorne o fence. Só depois discutir ativação progressiva.

Rastreamento: Issue #160, PR desta implementação, WBS IAM.
