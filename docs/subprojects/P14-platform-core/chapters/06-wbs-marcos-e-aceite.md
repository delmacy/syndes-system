## 6. WBS, milestones e aceite

### Vínculos já registrados na WBS (não ownership exclusivo)

A [EVOLUÇÃO P14](../EVOLUCAO.md) contém tarefas **00.01, 50.01, 50.08, 55.03, 70.09 e 95.01** e a [WBS de composição](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WBS-COMPOSICAO-MODULAR-CORE-20261111.md) contém CMP-01 a CMP-10. São **estados históricos**, não um percentual nem novas sprints.

| Frente | Trabalho | Estado de origem | Evidência que falta |
|---|---|---|---|
| 00.01/50.01 | Baseline e paridade main/DevServer | PEND na WBS | Inventário por SHA e comparação de runtime |
| 50.08 | Gate Basic CRM/Inbox/WhatsApp | BLOQ na WBS | Jornada real com identidade, tenant e consentimento |
| 55.03 | Serviço com Host/installer e gates | API opt-in, Control/restore/FGA reais BLOQ | `@syndes/service` listado no loader **não está**; ativação requer owner e gates |
| 70.09 | Product Gate por módulo | PEND | QA, UX, dados/operador e sign-off |
| 95.01 | Definition of Done | PEND | Critérios e aprovação de owners |
| CMP-01 | Contratos/ports/provedores e dependências | **PEND** no plano de composição | Matriz aprovada + testes negativos de fronteira |
| CMP-02 | Schema de `composition-profile` e validador offline | **PEND** | Schema/validador confiável + rejeição de entradas inválidas |
| CMP-03 | Duas instâncias locais com subconjunto confiável | **PEND** | Startup determinístico sem editar código de domínio |
| CMP-04–09 | Imagens, entitlements, isolamento, ownership e staging | PEND/BLOQ/CONDICIONAL | Build attestation, FGA, backup/restore e testes de 2 tenants |
| CMP-10 | UI opcional de composição | P2 | Product Gate futuro, fora do MVP atual |

### Status desta revisão

1. **Inventário de contrato executável:** Kernel/Host/Control/Modules/Events diferenciados com fontes. Auditoria documental parcial, não conclusão de CMP-01.
2. **Baseline CI:** [run 43345095065](https://github.com/delmacy/syndes-system/actions/runs/43345095065) no SHA `e2c5194` — 24/24 `success`; prova de CI, não aceitação da composição ou serviço.
3. **Matriz de arquitetura:** direitos de owner, endpoints do Host e exports do Kernel foram registrados sem mudar interfaces.
4. **Implantação/perfis:** nada habilitado, nenhum worker iniciado, nenhuma migration operacional aplicada nesta auditoria.

### Critérios mínimos antes de promover P14

- Aprovar matriz real de APIs/ports e owners (CMP-01), com testes de dependência, negação e compatibilidade por consumidor.
- Implementar/validar **schema de profiles offline** (CMP-02) com versionamento, integridade, conflito de rotas e dependências antes de qualquer startup; obter autorização de execução em A04/A08.
- Reconciliar módulos presentes no build/loader versus instalação/ENABLED de tenant e FGA (CMP-05).
- Homologar worker/dispatchers somente após Control+tenant schemas, service grant FGA, ownership exclusivo e teste restaurável em staging.
- Validar duas composições reais sob dois tenants, com digest, recursos, logs, rollback e aceite; não atribuir DONE a P14 antes dos gates correspondentes.

**Próxima unidade documental na ordem:** **I02 — Hospedagem e ambientes**, após P14. Não transformar esta análise em implementação de perfis/módulo sem escopo e autorização próprios.
