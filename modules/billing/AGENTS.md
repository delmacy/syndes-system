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
