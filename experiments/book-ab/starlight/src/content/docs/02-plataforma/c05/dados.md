---
title: "C05 · Dados e persistência"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dados e persistência

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/STATUS.md)

> L20: - Os renderers podem produzir configurações para PostgreSQL/Keycloak/OpenFGA; **a existência do código de renderer não significa que todos os consumidores já migraram**, estejam configurados ou tenham retirado seus dados da distribuição por ambiente.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/REFERENCIA-TECNICA.md)

> L19: \| C05 \| `render_runtime.main` (`render_runtime.py`) \| Verifica URL fixa, diretório protegido e CA; autentica AppRole e lê KV de `postgres`, `keycloak`, `openfga`; gera arquivos via `mkstemp` + `os.replace`; tenta revogar token \|

> L42: A conexão apresentada é **arquitetura declarada e/ou caminho no código**, não topologia implantada comprovada. Nenhuma UI própria pertence ao C05. O cofre não define entidades CRM/Inbox, eventos de negócio nem migrations Tenant DB. `openbao_raft` é persistência interna do serviço OpenBao, sem inferir PostgreSQL separado.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/OPERACAO.md)

> L10: 4. Separar os consumers efetivamente migrados (Core Host, Manager, PostgreSQL, Keycloak, OpenFGA) por ambiente; não extrapolar do código/README. Testar restart/reload, rotação e fallback recusado.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/chapters/04-contratos-e-dependencias-publicas.md)

> L4: - Renderer C05 `render_runtime.main`: AppRole de provisionamento, KV `postgres/keycloak/openfga` e saída de arquivos protected tmpfs; não é HTTP endpoint SaaS.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L14: **Persistência:** volume Raft próprio `openbao_raft`; não é database PostgreSQL Tenant/Control. **Rede:** `syndes-secrets` de escopo de serviços autorizados, sem pressupor host publicado. **Frontend:** nenhum próprio. **Configuração:** fontes listam `BAO_ADDR`, `CORE_OPENBAO_URL`, `CORE_BAO_ROLE_ID_FILE`, `CORE_BAO_SECRET_ID_FILE` e paths de runtime; não incluir valores/credenciais.

> L16: **Migração:** renderer suporta arquivos de outros serviços, mas isso sozinho não atesta migração final de Keycloak/OpenFGA/PostgreSQL.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
