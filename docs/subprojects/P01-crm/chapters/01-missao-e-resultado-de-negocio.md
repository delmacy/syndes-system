## 1. Missão e resultado de negócio

O Core CRM constitui **a fonte canônica de cadastro e relacionamento básico de pessoas e organizações de contato comercial** no contexto de um tenant. Deve permitir encontrar, relacionar, atualizar, classificar e auditar informações de relacionamento utilizadas pelos fluxos de atendimento.

**Beneficiários:** operadores de atendimento, equipes comerciais, usuários administrativos do tenant e módulos consumidores autorizados.

**Resultado do MVP:** um operador autenticado localiza ou cadastra uma pessoa, associa a uma organização de cadastro, consulta suas identidades de canal, relacionamentos, notas e histórico, evitando perda ou sobreposição indevida de informações de contato.

**Não é CRM de vendas avançado:** pipeline de oportunidades, propostas, lead scoring, previsões, automações de marketing e campos dinâmicos avançados são pós-MVP, sem autorização de implementação neste subprojeto.

### Critérios de valor verificáveis

| OBJ | Resultado | Prova |
|---|---|---|
| P01-OBJ01 | Identificar pessoas e organizações sem cruzar tenants | Testes de isolamento A/B e consulta autenticada |
| P01-OBJ02 | Construir ficha completa e histórico de relacionamento | Jornada Workspace com dados reais e perfis distintos |
| P01-OBJ03 | Integrar contatos vindos de canais sem destruir dados confirmados | Eventos/contratos de identidade, conflitos e testes negativos |
| P01-OBJ04 | Importar/exportar registros com segurança e limites | CSV com validação, limites, escaping e FGA |
| P01-OBJ05 | Preservar compatibilidade com dependências opcionais | Teste de capabilities ausentes/desabilitadas |

---
