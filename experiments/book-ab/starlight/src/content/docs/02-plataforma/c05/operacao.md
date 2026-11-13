---
title: "C05 · Operação e implantação"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Operação e implantação

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/STATUS.md)

> L15: \| Operação \| NÃO HOMOLOGADA \| Inicialização, unseal, backup Raft, revogação, rotação, observabilidade e recuperação pendentes \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/REFERENCIA-TECNICA.md)

> L3: > **AUDITORIA ESTÁTICA + CONTAINER UP — 13/11/2026.** Baseline `e86beda`; não houve requisições ao OpenBao, leitura de KV, comandos administrativos ou dump de arquivos runtime. Código versionado não significa configuração em operação.

> L13: \| Manager / operação \| `infra/master-admin/openbao/{render-master.py,operator-provision.py,run-renderer.sh}` \| Operador e renderer próprios; revisão operacional e autorizações separadas \|

> L42: A conexão apresentada é **arquitetura declarada e/ou caminho no código**, não topologia implantada comprovada. Nenhuma UI própria pertence ao C05. O cofre não define entidades CRM/Inbox, eventos de negócio nem migrations Tenant DB. `openbao_raft` é persistência interna do serviço OpenBao, sem inferir PostgreSQL separado.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/OPERACAO.md)

> L11: 5. Preparar backup off-host e exercício de snapshot/restore do Raft, custódia de recovery/unseal, procedimento de rollback e aprovação de segurança antes de registrar operação homologada.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/chapters/06-wbs-marcos-e-aceite.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
