---
title: "I02 · Testes e evidências"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Testes e evidências

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/STATUS.md)

> L7: \| Dimensão \| Situação e evidência \| Não permite concluir \|

> L11: \| **Saúde de containers** \| PostgreSQL 17 principal e Manager visual relatavam **healthy**; **14 containers sem healthcheck Docker** \| Que os 14 estejam unhealthy ou que os 2 tenham Product Gate \|

> L22: 1. **P0 documental — mapa de ambientes incompleto.** Somente DevServer01 foi inspecionado; não vincular sem evidência `server02` ou `win1-server` a staging/produção.

> L24: 3. **P1 — container PostgreSQL de teste sem lifecycle claro.** PG17-alpine avulso, `Up` há ~43h, sem label de descarte. Investigar owner e dados antes de limpeza; **não apagar nem migrar automaticamente**.

> L25: 4. **P1 — borda e segurança de hosts.** Traefik com bindings publicados e Komodo em endereço específico: exposição real depende de firewall/ACL/HTTPS; exigir teste em I06/I12.

> L32: \| Referência \| Origem \| Estado preservado \| Ação para fechar o gate \|

> L43: - [Operação](OPERACAO.md): comandos **somente leitura**, restrições para segredos e gates.

> L49: \| 2026-11-12 23:27 America/Sao_Paulo (13/11 02:27 UTC) \| DevServer01, metadados Docker e manifest Git `9ac228e` \| 16 Up, 8 Compose, 2 avulsos, 13 redes, 19 volumes \| Evidência de desenvolvimento, não homologação \|

> L53: **Status final:** auditoria parcial com evidência real do DevServer01; homologação/staging/produção **não verificados**.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/REFERENCIA-TECNICA.md)

> L26: \| **Desenvolvimento** \| DevServer01 — conector remoto online e Docker consultado \| 16 containers em execução; Docker, PostgreSQL, IAM, secretos, Komodo/Traefik, Host, Workspace, WhatsApp, previews \| **OBSERVADO em 12/11/2026**, health funcional e Product Gate não homologados \|

> L34: \| Indicador \| Evidência do instante \|

> L42: \| PostgreSQL de teste \| PG17-alpine com nomenclatura de ensaio, em execução há ~43h, sem label de descarte nem owner de projeto; loopback; **não limpar automaticamente** \|

> L54: \| Canal WhatsApp \| Gateway Whatsmeow \| Sessão, callbacks e negativas exigem teste de domínio \|

> L55: \| Testes ad hoc \| PostgreSQL 17-alpine sem label/projeto \| Necessidade/owner desconhecidos; risco de resíduo de ensaio e uso de recursos \|

> L67: - **Backup/restore:** existência de volumes e scripts não comprova RPO/RTO; o gate operacional requer teste em staging autorizado.

> L72: - [CI mainline no SHA de origem](https://github.com/delmacy/syndes-system/actions/runs/43350764378): **24/24 jobs success**, inclusive testes descartáveis de Infra; isso não equivale ao inventário real dos serviços do DevServer01 nem a staging/produção homologados.

> L74: - [Operação](OPERACAO.md): procedimento de inspeção não destrutiva e gates; sem comando para remover containers ou rodar DDL.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/OPERACAO.md)

> L7: - [STATUS](STATUS.md): nível de validação, bloqueios, testes, ambiente e SHA.

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

> L33: 5. Registrar resultado e evidência em STATUS, sem confundir merge com deploy ou aceite.

> L60: 5. Não parar, remover, reiniciar ou coletar dados de containers avulsos (incluindo o PostgreSQL PG17 de teste) sem confirmação do owner e plano próprio.

> L61: 6. Validar por outra frente TLS/firewall/Tailnet, backup/restore, DR e Product Gate. A aprovação do CI não comprova o host.

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/chapters/06-wbs-marcos-e-aceite.md)

> L13: \| Critério de conclusão documental \| Evidência obtida \| Estado \|

> L20: \| Backend/Frontend real \| Host, Workspace e Gateway executando \| **Containers Up, sem Product Gate** \|

> L21: \| CI do repositório \| [run 43350764378](https://github.com/delmacy/syndes-system/actions/runs/43350764378) — 24/24 success no SHA `9ac228e` \| **Teste de CI, não deploy do DevServer01** \|

> L29: 4. Para **produção**: decisão expressa de implantação, política de backup/restore e RPO/RTO medidos, trilha de auditoria, alertas, rollback, janela e Product Gate.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
