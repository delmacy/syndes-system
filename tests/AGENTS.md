# AGENTS.md — Tests

## Missão

Provar comportamento, segurança, isolamento, integridade e capacidade sem reduzir qualidade para obter CI verde.

## Pirâmide/princípio

Use o teste mais barato que prove a propriedade:

- unit para regra local;
- integration para contrato/persistência;
- end-to-end para jornadas críticas;
- security/isolation para fronteiras;
- performance para capacidade e recuperação.

## Regras

- Não remover assertion sem justificar requisito alterado.
- Não mascarar flaky test com retry ilimitado.
- Testes cross-tenant são obrigatórios para qualquer recurso com dados de tenant.
- Testes de boundary são obrigatórios em billing/rate limits.
- Mocks de providers devem simular erro, timeout e duplicação, não apenas sucesso.
- Fixtures não podem conter secrets reais.

## Release invariants

- cross-tenant leaks = 0
- unauthorized access = 0
- corrupted records = 0
- silent message loss = 0
