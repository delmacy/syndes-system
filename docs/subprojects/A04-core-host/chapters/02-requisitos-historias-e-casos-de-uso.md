## 2. Requisitos, histórias e casos de uso

| ID | Fluxo implementado/candidato | Aceite ainda necessário |
|---|---|---|
| A04-RF01 | Inicializar plugins declarados e validar IDs/assets | Compilação e testes isolados por SHA |
| A04-RF02 | Health e readiness sem expor credenciais | Health HTTP no ambiente-alvo |
| A04-RF03 | Autorizar recurso por identidade, tenant e FGA | Matriz negativa A/B e grants reais |
| A04-RF04 | Resolver banco tenant por registro Control | PG17 segregado e grants |
| A04-RF05 | Impedir execução de módulo não habilitado | Testes de admission em rotas e jobs |
| A04-RF06 | Compor entrega de eventos com service grants | Testes C06 e rollback/replay |

Requisitos não são homologados por estarem no código. Nenhum cenário operacional foi executado nesta revisão.
