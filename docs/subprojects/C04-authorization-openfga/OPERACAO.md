# C04 — Authorization OpenFGA | Operação

> **NÃO É RUNBOOK HOMOLOGADO.** O container OpenFGA foi observado Up no DevServer01 (13/11/2026); o modelo, stores, tuples, versões e resultados reais **não foram consultados**. Sem operação de escrita, autenticação administrativa ou deploy.

## Checklist para futura homologação, dependente de aprovação

1. Verificar versão/digest OpenFGA, health e config ativa com operador autorizado; registrar metadados seguros, sem divulgar endpoint privado, tokens, IDs de recursos ou tuples.
2. Confrontar modelo ativo do store contra `fga-model.json` SHA-pinned. Conferir `user/resource/tenant` e `service/event_delivery` antes de habilitar consumidores.
3. Executar matriz de negativas: token/cliente errado, sem membership, tenant A/B, organização/workspace errado, módulo disabled, service principal falso, consumer/evento diferente, revogação e indisponibilidade do serviço.
4. Validar fail-closed e suspensão recuperável de workers, métricas higienizadas, rollback de versão/tuples, backup/restore e processo de recuperação.
5. Exigir sign-off de C01/C03/C04/A04/A06/C06, testes CI e testes HTTP/PG17/OpenFGA no ambiente-alvo por SHA antes de registrar Product Gate.

## Não autorizado nesta auditoria

- Não executar `openfga-migrate`, DDL, comandos de tuple write, mudanças de modelo, policy, OpenBao ou grants reais.
- Não ativar worker/event service principal ou usar grants de usuários como bypass.
- Não concluir implantação/segurança pela imagem Docker em execução ou pelos testes sintéticos.

## Fontes e navegação

[STATUS](STATUS.md) · [SPRINT](SPRINT.md) · [Evolução](EVOLUCAO.md) · [Projeção](PROJECAO.md) · [Implementação](IMPLEMENTACAO.md) · [Alteração rápida](ALTERACAO.md) · [Referência técnica](REFERENCIA-TECNICA.md).

Modelo: `infra/security-access/fga-model.json`. Testes: `apps/core-host/test/adapters.test.mjs`, `platform-event-service-grant.test.mjs`, `platform-event-service-grant-fga.test.mjs`.
