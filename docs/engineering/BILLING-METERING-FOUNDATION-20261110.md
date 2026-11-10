# ADR / WBS — Uso, quotas e futura cobrança Syndes

**Estado:** contrato de medição em implementação; Billing permanece planejado, não implantado. **Data:** 2026-11-10. **Relação:** WBS mestre 70.06 e frente AK-10/20/30/50 da PR #65. **Sequência:** Kernel/Account & Access → Organizations/CRM → Inbox → WhatsApp → módulos MVP planejados → Billing (PRD-009) quando sua fase chegar. Não antecipar PSP/fatura nesta frente.

## Decisão: Billing, não Payments

O nome do domínio de assinatura e cobrança da própria plataforma é **Subscription & Billing**, com slug/schema futuro `billing`. **Payments** será uma responsabilidade interna de liquidação/conciliação e integração PSP, não o nome do módulo inteiro. Não confundir com `finance` de gestão financeira dos clientes (futuro e fora do MVP).

- **Account/Control Plane**: cliente, contrato, catálogo, módulos disponíveis, habilitados e quotas/limites acordados. Contratação e autorização não significam consumo nem pagamento confirmado.
- **Core Kernel**: tipos de métricas e eventos de uso e interfaces de integração; **sem preço, descontos, promoções, faturas, gateways, tributos ou cálculos monetários**.
- **Módulos**: medem o uso de sua própria fonte de verdade; o evento deve ser identificável, repetível sem duplicação e atribuível ao tenant, com métrica versionada. Nenhuma dependência de Billing para executar CRM/Inbox/WhatsApp.
- **Usage Metering (componente transversal futuro)**: validação, persistência, deduplicação, agregação por período, correções, snapshots auditáveis. Métrica operacional **não implica** cobrança. Não faturar retries, jobs repetidos ou eventos não confirmados.
- **Billing (PRD-009, posterior)**: catálogo comercial de preços versionados, planos, combos, assinatura, período, promoção, descontos, prorrata quando aprovada, impostos, faturas, créditos, pagamento, inadimplência e reconciliação PSP. Uma fatura congela preço e política aplicados; alterar preço hoje não recalcula o passado.
- **OpenFGA + tenant module entitlements**: decide uso, nunca preço. Revogação/suspensão não apaga dados; o runtime nega operações e eventos assíncronos que dependem do módulo.

## Modelo mínimo para preparar agora — sem criar tabelas de cobrança

```text
module_catalog (Control Plane) — id, version, owner, dependencies
module_meter_definitions (catálogo futuro) — meter_id, module_id, unit,
    aggregation, source, definition_version, effective_from
tenant_module_entitlements (Control Plane futuro) — tenant_id, module_id,
    enabled, effective_from/to, contractual_quota_version
usage_events / usage_snapshots (metering futuro) — tenant_id, meter_id,
    source_event_id (unique within source + tenant), event_id, occurred_at,
    quantity, definition_version, recorded_at, correction_link
billing.* (módulo futuro, banco operacional da Syndes) — plans, price_versions,
    subscriptions, invoices, invoice_lines, payments, credits, promotions
```

**Observação:** as linhas acima são entidades propostas, não schema SQL já existente. O evento de medição no Core Kernel é somente **contrato de formato** e não uma autorização para gravar, cobrar ou reter PII. Não converter o manifest de `@syndes/*` em catálogo monetário.

## Questões de produto que precisam de definição antes de cobrar

- Definição de **operador faturável**: cadastrado, ativo, atribuído a workspace, simultâneo ou pico mensal? Funcionário CRM não é necessariamente login Keycloak. Quem é o responsável pelo estado durante transferências?
- Qual unidade de WhatsApp: número configurado, conectado, ativo no período, sessão, mensagem confirmada? Eventos `retry` não equivalem a mensagem cobrada.
- Quais métricas serão cobradas e quais são somente limites de segurança ou observabilidade? Limite de **40 mensagens/min/número** é operacional e não tarifa.
- Período de apuração, timezone, janela de atualização tardia, arredondamento, retificação, reembolso, prorrata, período promocional e impostos.
- Política de planos e composição: base + módulos + operadores + outras unidades + combo. Versionar preços e condições antes do primeiro invoice.
- As regras vigentes documentadas de `paid_until` e suspensão D+11/D+31 são contratos históricos do produto; mudança exige revisão específica do PRD e testes, não reinterpretação automática por esta ADR.

## WBS executável

| ID | Prioridade | Entrega / aceite objetivo | Depende | Estado |
| --- | --- | --- | --- | --- |
| BM-00 | P0 | Registrar decisão do domínio Billing e fronteiras de Account/Kernel/Metering/Billing | AK-10 | DONE (documentação) |
| BM-01 | P0 | Contrato puro de `UsageMeterDefinition`, `UsageEvent`, validação de formato e testes | Kernel existente | IMPLEMENTED (PR pendente) |
| BM-02 | P0 | Reservar extensões do manifesto de módulos para `meterDefinitions`, sem obrigar módulos existentes a declararem métricas | AK-10.01 | PEND |
| BM-03 | P0 | Definir quotas e estados de entitlement por tenant independentemente de preço/uso, com testes de expiração e suspensão | AK-10.03, AK-20.01 | PEND |
| BM-04 | P1 | Especificar medição por módulo e fonte; preservar evento original, versão e chave idempotente; testar dois tenants/retries | AK-40, BM-02 | PEND |
| BM-05 | P1 | Implementar persistência e agregação audível por intervalo em Metering somente quando consumidor real exigir | BM-04 | PEND |
| BM-06 | P2 | PRD Billing: critérios de operador, quotas, agregação, moeda, tributos, períodos, preços/combos e faturamento | BM-03, BM-05, WBS 70.06 | PEND |
| BM-07 | P2 | Implementar `billing` isolado com preços versionados, assinatura, faturas, pagamento, crédito, PSP e auditoria | BM-06 | BLOQ |
| BM-08 | P2 | Segurança, testes de faturamento e lançamento: webhook duplicado/fora de ordem, ledger, reconciliação, rollback e sem dado cartão | BM-07, gates da WBS 95 | BLOQ |

## Critérios para o primeiro módulo adaptado (Organizations)

1. Não criar tabelas de Billing, preços nem métricas fictícias de consumo.
2. Manter vínculo account↔tenant, memberships e validade com efeito imediato nas APIs e jobs.
3. Ter schema próprio `organizations` e migrar SQL/guards/testes qualificados em PG17 descartável, preservando trava SQL 002 e FGA por organização/workspace.
4. Preparar o modelo de membros para futura contagem de operadores, **sem** considerar Employee, User, Membership e operador faturável equivalentes.
5. Registrar dependências de outros módulos e não mover dados do Control DB para o tenant DB.
