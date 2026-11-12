## 10. Metas e WBS por entregáveis

| Meta | Resultado demonstrável | Gate |
|---|---|---|
| P01-M01 | Cadastros básicos, relações, tags, notas e auditoria com tenant isolado | Testes domínio/SQL/HTTP |
| P01-M02 | Identidades de canal, perfis associados e CSV seguros | Testes de compatibilidade e dados |
| P01-M03 | Integração WhatsApp/Inbox e contextos opcionais sem perda de dados CRM | Event contracts e testes A/B |
| P01-M04 | Jornada completa no Workspace com papéis reais | Browser E2E Keycloak/FGA |
| P01-M05 | CRM demonstrável e operacional sob gates do tenant | Preflight, deploy autorizado, observabilidade e aceite |

| WBS | Entregável | Metas associadas | Aceite |
|---|---|---|---|
| P01.01 | Domínio e persistência CRM canônicos | M01 | Suite PostgreSQL, isolamentos, auditoria |
| P01.02 | APIs de cadastro, relacionamentos, busca, CSV e capabilities | M01/M02 | Contratos HTTP + testes negativos |
| P01.03 | Reconciliação segura de identidade de canais | M02/M03 | Evento resolvido/revisão, replay e não sobrescrita |
| P01.04 | Experiência CRM no Workspace | M04 | Fluxos reais, acessibilidade e autorização |
| P01.05 | Homologação integrada e Product Gate CRM | M05 | E2E multiusuário/tenant, smoke e decisão de aceite |

**O WBS representa entregáveis, não tarefas em andamento.** Os resultados comprovados de cada bloco, pendências e sprint pertencem a `STATUS.md`.

---
