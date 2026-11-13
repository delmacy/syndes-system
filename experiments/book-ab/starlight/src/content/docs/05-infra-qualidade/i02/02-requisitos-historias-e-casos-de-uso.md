---
title: "I02 · Requisitos e casos de uso"
description: "Volume Infraestrutura e qualidade · capítulo I02 · matéria 02"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/chapters/02-requisitos-historias-e-casos-de-uso.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 2. Requisitos, histórias e casos de uso operacionais

As referências `I02-R*` são critérios de **documentação/revisão**, derivados de `infra/README.md`, WBS e instruções globais. Não são novos tickets aprovados, nem liberam ações em hosts.

| Critério documental | Evidência mínima de aceitação |
|---|---|
| I02-R01 — Inventário por ambiente | Ambiente, host autorizado, data/hora, origem, service owner e finalidade; ausência explícita de verificação |
| I02-R02 — Paridade declarada/observada | Compose versionado, projeto Compose em execução, imagem e presença/ausência de cada serviço, identificando overlays locais |
| I02-R03 — Redes e exposições | Redes internas x externas, serviços com `HostPort`, política de proxy/TLS e verificação de firewall sem divulgar IP/porta |
| I02-R04 — Segredos e bootstrap | OpenBao/AppRole/arquivos protegidos, ordem de inicialização e recovery; sem valores operacionais publicados |
| I02-R05 — Integridade Control/Tenant | Mapa dos databases/roles e negativa de conectividade indevida; testes com acesso autorizado e datasets de ensaio |
| I02-R06 — Manager segregado | API, front, identidade e redes separadas, com evidência de serviço real e não apenas visual de preview |
| I02-R07 — Recuperação | Existência de backup, retenção, restore ensaiado em ambiente distinto, RPO/RTO medidos, rollback/owner |
| I02-R08 — Observabilidade | Health funcional, logs sanitizados, retenção/rotação e alertas de disco/certificados |
| I02-R09 — Release | SHA/digest, aprovação, smoke, rollback e registro da janela de deploy/staging/produção |
| I02-R10 — Segurança documental | Ausência de credenciais, IPs privados, caminhos sensíveis de mounts e configuração do admin em páginas públicas |

### Histórias de uso

**US-I02-01 — Operação:** como administrador, preciso saber o que roda em cada ambiente e qual manifesto o define, para operar sem afetar preview e produção por engano.

**US-I02-02 — Engenharia:** como implementador, preciso localizar serviço, banco, rede, owner e gate antes de integrar módulo ou alterar host.

**US-I02-03 — Segurança:** como auditor, preciso separar portas publicadas, rede interna e rota autenticada, para não inferir proteção por presença de proxy.

**US-I02-04 — Continuidade:** como operador de release, preciso de prova de restore e rollback associada ao digest; backup agendado sem restore não comprova recuperação.

### Casos de uso

**UC-I02-A — Inventário seguro:** selecionar host/ambiente → obter autorização → `docker ps/inspect` filtrado (sem Env/Mount Source) → mapear imagem/projeto/network/health → comparar manifests → registrar divergências → revisão do owner.

**UC-I02-B — Preparar produção:** validar escopo aprovado → staging com imagens imutáveis → grants/identity/tenant → backup/restore → TLS/firewall/rate limit → smoke e logs → rollback testado → aceite. **Nenhuma dessas fases foi executada nesta auditoria.**

**UC-I02-C — Container sem owner:** confirmar Compose/project e quem o criou → classificar preview, fixture ou serviço persistente → validar dependências → solicitar limpeza autorizada em frente própria. **Nunca remover por inferência baseada no nome.**

### Critérios não funcionais

Deny-by-default, tenancy isolada, secretos fora do Git e logs, controle de acesso à Docker/Komodo, retenção com limiar de disco, recovery ensaiado e rastreabilidade por SHA. **Não inventar SLA, RPO/RTO ou quantidade de réplicas sem medição.**


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I02-server02/chapters/02-requisitos-historias-e-casos-de-uso.md).
