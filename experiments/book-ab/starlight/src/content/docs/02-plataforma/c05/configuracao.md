---
title: "C05 · Configuração e ambiente"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Configuração e ambiente

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/STATUS.md)

> L9: \| Infra/Compose \| Imagem versionada, HTTPS listener, rede privada `syndes-secrets`, Raft nomeado `openbao_raft` \| Container Up ≠ unsealed, saudável ou cofre utilizável \|

> L21: - `infra/security-access/openbao/README.md` descreve limitações explícitas de migração; reconciliar Compose e runtime-alvo antes de publicar estado final.

> L22: - O Raft usa um único volume/nó no Compose conhecido; criptografia por barreira depende de unseal; volume não substitui backup testado.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/REFERENCIA-TECNICA.md)

> L3: > **AUDITORIA ESTÁTICA + CONTAINER UP — 13/11/2026.** Baseline `e86beda`; não houve requisições ao OpenBao, leitura de KV, comandos administrativos ou dump de arquivos runtime. Código versionado não significa configuração em operação.

> L9: \| C05 — servidor \| `infra/security-access/compose.yaml`, `infra/security-access/openbao/config.hcl` \| OpenBao `openbao/openbao:2.7.0`, HTTPS, rede `syndes-secrets`, volume `openbao_raft`; não é banco Tenant/Control \|

> L22: \| A04 \| `openBaoSourceFromEnv` \| Seleciona somente `CORE_OPENBAO_URL`, `CORE_BAO_ROLE_ID_FILE`, `CORE_BAO_SECRET_ID_FILE`; não substitui segredo falho por env \|

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/OPERACAO.md)

> L9: 3. Validar arquivos tmpfs, permissões, atomicidade do renderer, escopo de rede, expiração e revogação de tokens. A ausência de secrets em logs/compose/metadata requer prova específica.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L14: **Persistência:** volume Raft próprio `openbao_raft`; não é database PostgreSQL Tenant/Control. **Rede:** `syndes-secrets` de escopo de serviços autorizados, sem pressupor host publicado. **Frontend:** nenhum próprio. **Configuração:** fontes listam `BAO_ADDR`, `CORE_OPENBAO_URL`, `CORE_BAO_ROLE_ID_FILE`, `CORE_BAO_SECRET_ID_FILE` e paths de runtime; não incluir valores/credenciais.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
