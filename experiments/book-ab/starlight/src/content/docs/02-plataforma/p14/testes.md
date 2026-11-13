---
title: "P14 · Testes e evidências"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Testes e evidências

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/STATUS.md)

> L7: O levantamento complementa os testes históricos; o CI remoto verde não aprova operação ou perfis por instância.

> L11: \| Dimensão \| Evidência verificada \| Limite real \|

> L15: \| **Core Kernel A08** \| `packages/core-kernel`: `CoreKernel`, `ModuleRegistry`, ports, `SyndesPlugin`, eventos tipados \| Package privado; implementação e testes pertencem a A08 \|

> L17: \| **Módulos e Tenant/Control** \| Implementação dividida por owners; Control ENABLED, membership/FGA/tenancy e tenant DB têm gates próprios \| `executeModule` é opt-in; não declarar enforcement universal sem testar cada endpoint \|

> L19: \| **Testes locais históricos** \| Auditoria anterior do checkout `b452a03e`: Kernel **35 PASS**, Host **63 PASS, 19 SKIP** \| Não reexecutados nesta revisão; skips não comprovam PG17/staging/Keycloak/FGA \|

> L20: \| **CI integrado da baseline** \| [run 43345095065](https://github.com/delmacy/syndes-system/actions/runs/43345095065) — **24/24 jobs success** no SHA `e2c5194` \| Ambiente de CI, não deploy/restore/Product Gate \|

> L22: \| **Aceite/Operação** \| Nenhuma homologação feita nesta frente \| Release, backup/restore, service grants, rollout e Product Gate pendentes \|

> L39: 3. **Serviço Basic:** package `@syndes/service` é dependência do Host, mas não está em `config/modules.json`; módulos precisam ser montados/ENABLED com grants e Product Gate específicos.

> L40: 4. **Eventos:** migrations de tenant/Control, FGA service grants, projetor único WhatsApp, backup/restore e worker operacional dependem de gates separados.

> L41: 5. **Testes de integração reais:** resultados históricos com SKIP não servem como aceite de DB, tenant, FGA/Keycloak ou instalação; CI atual só comprova seu próprio SHA.

> L51: - **Próximo candidato técnico:** validar CMP-01 (matriz de port/adapters/consumers e testes de fronteira) e depois especificar CMP-02 offline, sob autorização do owner. Nada de perfil/projeto dedicado em runtime antes de CMP-03+ e gates operacionais.

> L56: \| 2026-11-12 \| `b452a03e`, DevServer01 \| Testes locais históricos Kernel 35, Host 63; 19 skip \| Deploy/staging/CI desse SHA \|

> L58: \| 2026-11-12 \| `e2c5194`, worktree documental P14 \| Reconciliação estática de código e política, sem mutações de runtime \| Aprovação dos contratos e Product Gate \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/REFERENCIA-TECNICA.md)

> L24: \| `CoreKernel.executeModule(...)` \| Gate **opt-in** de `ModuleAccessPort`, não ativado automaticamente em todos os controllers \|

> L46: Isso não prova que todos os controllers de domínios tenham sido migrados para o gate de `executeModule`. Não expor `main.ts` como API SDK do Kernel.

> L51: - A04 provê `TenantPgProvider`, adapters, publishers e dispatchers; A08 define o contrato. Workers automáticos, grants reais e DDL operacional dependem de gates separados.

> L54: - **Segurança:** qualquer mudança cross-owner exige revisão, testes de consumidores, tenant isolation e autorização; a inspeção não concede acesso operacional.

> L58: - **Histórico:** [STATUS P14](STATUS.md) registrava em revisão anterior 35 testes locais Kernel PASS e 63 Host PASS, com **19 SKIP**; isso não foi reexecutado como teste de produto nesta auditoria documental.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/OPERACAO.md)

> L7: - [STATUS](STATUS.md): nível de validação, bloqueios, testes, ambiente e SHA.

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

> L33: 5. Registrar resultado e evidência em STATUS, sem confundir merge com deploy ou aceite.

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/chapters/06-wbs-marcos-e-aceite.md)

> L7: \| Frente \| Trabalho \| Estado de origem \| Evidência que falta \|

> L10: \| 50.08 \| Gate Basic CRM/Inbox/WhatsApp \| BLOQ na WBS \| Jornada real com identidade, tenant e consentimento \|

> L11: \| 55.03 \| Serviço com Host/installer e gates \| API opt-in, Control/restore/FGA reais BLOQ \| `@syndes/service` listado no loader **não está**; ativação requer owner e gates \|

> L12: \| 70.09 \| Product Gate por módulo \| PEND \| QA, UX, dados/operador e sign-off \|

> L14: \| CMP-01 \| Contratos/ports/provedores e dependências \| **PEND** no plano de composição \| Matriz aprovada + testes negativos de fronteira \|

> L17: \| CMP-04–09 \| Imagens, entitlements, isolamento, ownership e staging \| PEND/BLOQ/CONDICIONAL \| Build attestation, FGA, backup/restore e testes de 2 tenants \|

> L18: \| CMP-10 \| UI opcional de composição \| P2 \| Product Gate futuro, fora do MVP atual \|

> L29: - Aprovar matriz real de APIs/ports e owners (CMP-01), com testes de dependência, negação e compatibilidade por consumidor.

> L32: - Homologar worker/dispatchers somente após Control+tenant schemas, service grant FGA, ownership exclusivo e teste restaurável em staging.

> L33: - Validar duas composições reais sob dois tenants, com digest, recursos, logs, rollback e aceite; não atribuir DONE a P14 antes dos gates correspondentes.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
