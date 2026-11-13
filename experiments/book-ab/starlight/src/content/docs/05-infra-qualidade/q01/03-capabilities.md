---
title: "Q01 · Capacidades"
description: "Volume Infraestrutura e qualidade · capítulo Q01 · matéria 03"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/chapters/03-capabilities.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 3. Capacidades existentes e lacunas

### Inventário de fontes encontradas no checkout

| Área de teste | Caminhos presentes | Natureza observada |
|---|---|---|
| Integridade estrutural | `tests/integrity/repository-structure.sh` | Executável Bash; executa checker do catálogo; owner Q10 |
| Postgres/tenancy | `tests/platform/postgres-smoke.sh`, `account-roles-pg-smoke.sh`, `platform-manager-postgres-smoke.sh` | Smoke de DB/roles/migrações em fixtures, com salvaguardas |
| Segurança OpenFGA/OpenBao | `tests/platform/openfga-smoke.sh`, `openbao-smoke.sh` | Exercitam autorizações e secret lifecycle em ambiente de CI |
| Identity Manager | `tests/platform/platform-manager-keycloak-ci.mjs`, `platform-manager-host-gate.sh` | Keycloak de ensaio, JWT assinado e boundary do Manager |
| Redes e configuração | `tests/platform/platform-manager-network-smoke.py`, `test-manager-tailnet-route.py`, `test-manager-keycloak-redirect.py` | Redes/rotas/negativas; partes são simulações configuracionais |
| Operações Manager | `test-owner-bootstrap.py`, `test-master-secret-render.py`, `test-manager-operator-provision.py`, `test-manager-release-checkout.py` | Validações locais de provisionamento, arquivo secreto e checkout |
| Core Host / integração | `tests/platform/core-host-runtime-smoke.sh`, `support-migration-*.test.sh` | Host/identidade e migrations em disposable CI |
| Suites distribuídas dos domínios | `modules/*/test`, `apps/*/test`, scripts próprios | Coberturas efetivas pertencem ao módulo e ao CI Q07 |
| Diretórios de diretrizes | `tests/integration/AGENTS.md`, `tests/security/AGENTS.md`, `tests/performance/AGENTS.md` | **Não têm executáveis próprios nesse checkout**; cobertura mora em outros diretórios |

### Amostra confirmada por CI de referência

No [run 43340637846](https://github.com/delmacy/syndes-system/actions/runs/43340637846), associado ao SHA `bd0aa69349879485156ce05ffcb211904d34c206`, houve **24/24 jobs success**, incluindo a regressão de infraestrutura e as paridades reais de Manager e Support. Essa evidência é do **ambiente descartável GitHub Actions**, não comprovação de instalação no DevServer/produção.

### Planejado, não comprovado

- `tests/performance/AGENTS.md`: escada 50, 200, 500, 1000, 2500 tenants, spike, soak de 2 horas, métricas p50/p95/p99 e recuperação. **Não há resultados de benchmark nesta auditoria.**
- `tests/integration` e `tests/security` documentam princípios, mas não oferecem executáveis próprios dentro dessas pastas. Cobertura parcial deve ser investigada por contrato e owner.
- Não foram medidos RPO/RTO reais, latência alvo, throughput, custo de CI ou volume de clientes homologados.

**Não confundir:** disponibilidade de script, execução local, CI verde, instalação, restore operacional e aceite são dimensões distintas.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/chapters/03-capabilities.md).
