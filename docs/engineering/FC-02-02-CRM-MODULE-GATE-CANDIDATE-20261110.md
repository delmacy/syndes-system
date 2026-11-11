# FC-02.02 — CRM HTTP admission por módulo ENABLED (candidato de rollout)

**Base:** main 0d209b778badb154f229bde344673dc71ebe7f4a, 2026-11-10.
**Status:** código e teste em staging descartável concluídos; NÃO aplicado em DevServer01 operacional. FC-02.02 geral permanece parcial: Inbox/SSE, WhatsApp ingress/worker/Go, Support e algumas entidades Organization ainda sem gate.

## Implementação

- Core Host recebe configuração confiável apenas server-side: SYNDES_CRM_MODULE_GATE=legacy|enforce. Valor ausente significa legacy para preservar operação antes do provisionamento; valores desconhecidos falham na inicialização. Nunca é header, cookie, rota ou preferência React.
- Com enforce, o guard central CrmDefaultContextGuard.resolve chama CoreKernel.executeModule usando moduleId crm, resource crm:context e action read. A sequência é JWT validado no Host → tenant membership → FGA por recurso → release compilada/aprovada + entitlement vigente + instalação ENABLED + metadata de attestation + dependências → lease do DB confiável do tenant → membership Organization/Workspace + SQL 002.
- Todos os endpoints HTTP CRM ingressam pelo CrmHost.run/context (inclusive capabilities, CSV, leitura e escrita). Autorizações adicionais FGA por ação nos serviços continuam obrigatórias. Nenhum endpoint foi renomeado.
- Com legacy, o guard mantém CoreKernel.execute e a restrição de contexto anterior. Não equivale a entitlement efetivo. É uma compatibilidade transitória, não uma modalidade comercial.
- Falha de Control DB com enforce nega antes de resolver DB de tenant (HTTP 403 fail-closed, sem afirmar que isso seja necessariamente licença revogada).

## Testes — PostgreSQL 17 real descartável e NestJS

Arquivo apps/core-host/test/crm-module-admission-pg17.test.mjs.

- Exige SYNDES_AK10_DISPOSABLE_PG=AK10_DISPOSABLE_ONLY e URL PostgreSQL localhost:postgres/postgres com senha de prefixo ci-only-disposable-. O teste cria e elimina banco aleatório efêmero. Em ausência do marcador, SKIP. Não toca em syndes_control operacional.
- Aplica control.schema, control-module-catalog.schema, control-module-lifecycle.schema em banco PostgreSQL17 real, com dois tenants A/B, catálogo crm@0.1.0 aprovado, entitlements e metadata de instalação.
- Usa NestJS HTTP real; verifier JWT, tenancy/FGA e SQL do banco tenant são fakes isolados. NÃO prova E2E real de Keycloak/OpenBao/OpenFGA ou de SQL do tenant.
- Sem JWT → 401; tenant inexistente → 403; A ENABLED → 200, B só INSTALLED → 403 em leitura/capabilities/export/POST sem sequer resolver DB tenant.
- B passa imediatamente após ENABLED, volta a negar com suspensão. A nega após suspensão, vencimento, instalação inválida/receipt ausente, deapproval de release e indisponibilidade do Control DB sem reiniciar NestJS.
- Testes unitários do guard: port ausente, FGA/tenant negados antes da verificação do módulo, Control DB com erro → deny. Modo Host inválido → erro de configuração.

Regressões locais: CRM 29/29 PASS; Core Host 74 PASS, 0 FAIL, 1 SKIP; teste HTTP/PG17 isolado 7/7 PASS. Builds TypeScript do Kernel, CRM e Core Host aprovados.

## Limites operacionais e plano de cutover

1. Backup e RESTORE efetivamente testado de Control DB e tenant DB; migrations versionadas, roles mínimas e mapeamento de tenants completos.
2. Aprovação e provisionamento de releases/entitlements/instalação ENABLED/receipts de TODOS os tenants afetados e sua dependência platform. Ledger físico precisa de reconciliação por serviço privilegiado; o Host confia no Control attestation, não consulta o ledger do tenant em cada requisição.
3. Revisão da janela de ativação: sem os dados provisionados, enforce bloqueia todo o CRM (comportamento esperado, não bug). Por isso a implantação operacional está BLOQUEADA. Reverter a legacy restaura apenas autorização antiga (JWT, FGA, contexto); NÃO mantém proteção de entitlement. Não permitir rollback para bypass de segurança em clientes ativos.
4. O gate valida na entrada HTTP: uma escrita iniciada antes da suspensão pode terminar; não substitui idempotência, transação, autorização do worker ou revogação de SSE já aberto.
5. Prosseguir a FC-02.02 com Inbox + SSE, WhatsApp callback/dispatch + Go gateway e Support. A infraestrutura base de Account/Organization deve continuar acessível sem depender de entitlement opcional circular.
6. Só depois da proteção completa, criar capabilities tenant-safe e atrelar o registry visual React aos módulos ENABLED. Esconder menu nunca substitui backend.

**Sem deploy, migrations em banco real, GitHub Actions, alteração em main protection, Keycloak, OpenBao, OpenFGA, Go ou frontend** nesta fatia.
