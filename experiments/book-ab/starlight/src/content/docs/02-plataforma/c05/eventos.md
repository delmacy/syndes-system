---
title: "C05 · Eventos e mensageria"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Eventos e mensageria

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/STATUS.md)

> L11: \| Consumidor Core Host \| `loadCoreSecrets` lê AppRole de arquivos, exige TLS, KV obrigatório, revoga token bootstrap \| Testes mockados; app runtime real não validado \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/REFERENCIA-TECNICA.md)

> L42: A conexão apresentada é **arquitetura declarada e/ou caminho no código**, não topologia implantada comprovada. Nenhuma UI própria pertence ao C05. O cofre não define entidades CRM/Inbox, eventos de negócio nem migrations Tenant DB. `openbao_raft` é persistência interna do serviço OpenBao, sem inferir PostgreSQL separado.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/chapters/04-contratos-e-dependencias-publicas.md)

> L7: - O C05 não publica evento de negócio ou API frontend. Contratos de auth/authorizer ficam em C03/C04/A04.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L14: **Persistência:** volume Raft próprio `openbao_raft`; não é database PostgreSQL Tenant/Control. **Rede:** `syndes-secrets` de escopo de serviços autorizados, sem pressupor host publicado. **Frontend:** nenhum próprio. **Configuração:** fontes listam `BAO_ADDR`, `CORE_OPENBAO_URL`, `CORE_BAO_ROLE_ID_FILE`, `CORE_BAO_SECRET_ID_FILE` e paths de runtime; não incluir valores/credenciais.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
