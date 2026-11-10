# AGENTS.md — Subscription & Billing

## Missão

Gerenciar plano, assinatura, pagamento, inadimplência e entitlements da própria Syndes.

Não é financeiro empresarial.

## Regra temporal

Cada pagamento confirmado concede 30 dias:

`paid_until = payment_confirmed_at + 30 dias`.

Pagamento atrasado inicia novo período na data de confirmação; não retroage.

## Inadimplência

- D+0 a D+10: operação completa.
- D+11: AI N1 suspensa.
- D+31: gateway WhatsApp suspenso.
- Dados e configuração permanecem preservados.
- Regularização reativa serviços automaticamente.

## Pagamentos

Planejado: cartão, Pix e boleto via PSP.

A aplicação não armazena dados completos de cartão.

Webhooks devem ser autenticados, idempotentes e auditados.

## Entitlements

Billing calcula estado; módulos consomem entitlement. Não duplicar regra financeira em AI/WhatsApp/CRM.

## Testes

- payment confirmation;
- duplicate webhook;
- out-of-order webhook;
- paid_until;
- D+10/D+11 boundary;
- D+30/D+31 boundary;
- reactivation;
- failed payment;
- PSP timeout;
- entitlement consistency;
- audit.

## Contrato transversal de módulos, schemas e metering (2026-11-10)

- Módulo possui schema PostgreSQL próprio nomeado pelo ID curto, após a fase de migração aprovada. Nenhum módulo controla schemas/tabelas de outros ou altera o Control DB por acesso direto. Integração entre módulos ocorre por API/contrato/eventos ou views de leitura aprovadas com dependências declaradas.
- Acesso depende de identidade Keycloak, membership tenant/org/workspace quando aplicável, habilitação no catálogo do Control Plane e OpenFGA; não utilizar `tenant_id` enviado pelo browser como autoridade. Desativar módulo não apaga dados. Migrações apenas por instalador aprovado e testes PG17 descartáveis.
- Se houver medição de uso necessária, declarar a métrica e sua fonte com idempotência; não atribuir preço, cobrar por retries nem implementar Billing/Payments dentro do domínio. O PRD-009 de Subscription & Billing continua posterior ao núcleo operacional.
- Consultar `AGENTS.md` da raiz, `docs/engineering/BILLING-METERING-FOUNDATION-20261110.md` e WBS/ADR da PR #65; não declarar schema migrado antes de comprovação SQL/Host/testes.
## Limites do Billing futuro (2026-11-10)

O nome canônico é **Subscription & Billing** (`billing`); Payments é subdomínio de processamento PSP. `finance` é outro produto, para financeiro do cliente, não este serviço. Manter como futuro PRD-009, sem construir agora tabelas, cobrança, PSP, UI ou preço no Kernel. O Account/Control Plane mantém entitlement e quota autorizados; Metering fornecerá consumo idempotente; Billing aplica política comercial versionada, guarda faturas históricas, descontos, combos, créditos, tributos e conciliação de webhooks. Regras existentes de `paid_until`, D+11 e D+31 continuam até Product Gate explícito. Nunca armazenar dados completos de cartão; segredos em OpenBao e separação do tenant DB.