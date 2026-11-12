## 9. Dependências e contratos opcionais

| ID | Dependência | Natureza | Efeito se não disponível |
|---|---|---|---|
| A08 | CoreKernel ports, tenancy e authorization | Obrigatória no Host | Nega execução protegida |
| A04 | Host NestJS, loader, guard e provider DB | Obrigatória para HTTP operacional | Serviço não sobe/indisponível |
| C01 / C02 | Catálogo/instalação ENABLED | Obrigatória para ativação controlada | Sem acesso operacional |
| C03/C04/C05 | Identidade, FGA, segredos | Obrigatória para produção | Fail closed |
| I04 | Banco do tenant | Obrigatória para persistência | Indisponível/sem DML |
| P02/P03/C06 | Observação WA/Inbox e resolução de identidade | Opcional para CRM básico | CRM básico permanece funcional |
| P04 | Contextos organization/workspace e workforce | Opcional para funcionalidades dependentes; gates atuais respeitados | Não habilitar multi-org sem SQL002 e grants |
| A01/A07 | UI Workspace e componentes compartilhados | Obrigatória para aceite da experiência | Backend pode existir sem UX homologada |
| Q03/Q05/Q07 | Testes de integração, segurança e CI | Gate de aceite | Não declarar entrega pronta |

**Atenção:** o campo "opcional" é relativo a uma **capability**, não altera silenciosamente as `dependencies` obrigatórias de `ModuleDefinition`.

---
