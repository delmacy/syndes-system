## 11. Riscos, lacunas e decisões que exigem debate

| ID | Questão | Impacto | Tratamento sugerido |
|---|---|---|---|
| R01 | `Organization` CRM confundida com Platform Organization | Vazamento ou acesso cruzado | Documentar IDs e mappings e testar |
| R02 | EmployeeProfile confundido com login/workforce | Conta/privilégio indevido | Manter contratos separados |
| R03 | Nomes externos sobrescrevem cadastro confirmado | Corrupção de dados mestres | Testar reconciliação sem overwrite |
| R04 | Frontend mockado tomado como operacional | Produto entregue sem permissão real | E2E com Keycloak/FGA/tenant reais |
| R05 | `crm.person.review_required.v1` sem tratativa operacional | Pendência invisível | Definir fluxo/consumidor antes da ativação |
| R06 | Multi-org liberado antes do gate SQL002 | Quebra de escopo de dados | Manter bloqueio e testes |
| R07 | Redução de capabilities e endpoints em paralelo com consumidores | Regressão silenciosa | Expand–migrate–contract + contract tests |

### Decisões pendentes para aprovação

1. Definir nomenclatura canônica no produto para diferenciar organização CRM e Platform Organization.
2. Definir critérios mínimos da tratativa de ambiguidades de identidade WhatsApp; sem inventar tela antes do PRD.
3. Definir quais capacidades de EmployeeProfile serão expostas no MVP de Workspace sem duplicar Workforce.
4. Aprovar este escopo e suas metas como baseline do P01 após revisão impressa.

---
