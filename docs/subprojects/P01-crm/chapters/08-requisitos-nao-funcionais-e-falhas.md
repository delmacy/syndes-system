## 8. Requisitos não funcionais e falhas

| Dimensão | Contrato de qualidade | Evidência exigida |
|---|---|---|
| Isolamento | Nenhuma operação CRM expõe registro de tenant B ao A | Teste A/B com roles e bancos distintos |
| Autenticação | JWT válido, issuer/audience e tenant membership | E2E com identidades reais |
| Autorização | Deny antes do lease DB quando necessário; FGA por recurso | Teste positivo, negativo, indisponibilidade FGA |
| Integridade | Atomicidade entre mutação e auditoria | Testes PostgreSQL e falhas simuladas |
| CSV | Limites, escaping e rejeição de entrada inválida | Unit e integração |
| Eventualidade | Idempotência/replay para eventos externos | Testes outbox/consumer com duplicação |
| Compatibilidade | Contratos públicos e migrations preservam consumidores | Testes de contrato + suites afetadas |
| UX | Formulários, acessibilidade, teclado, mobile e estados explícitos | Browser E2E autenticado e revisão |
| Recuperação | Backup preventivo antes de mutação de dados; restore completo no gate final MVP | Evidência de procedimento, sem alegar DR pronto |

Não atribuir metas numéricas de latência, uptime ou volumes que não tenham sido aprovadas; tratá-las como decisões pendentes.

---
