# AGENTS.md — Security Tests

## Obrigatório

- tenant isolation;
- authorization;
- ID tampering;
- webhook authenticity/idempotency;
- upload validation;
- secret leakage checks;
- AI tool authorization/prompt injection cases;
- session/access boundary tests.

## Regras

Uma violação cross-tenant é release blocker.

Testes devem verificar comportamento no backend. Esconder UI nunca conta como autorização.

Casos de segurança não podem ser removidos ou afrouxados apenas para obter CI verde.
