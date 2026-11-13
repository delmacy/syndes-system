---
title: "C05 · Contratos públicos e privados"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Contratos públicos e privados

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/STATUS.md)

> L9: \| Infra/Compose \| Imagem versionada, HTTPS listener, rede privada `syndes-secrets`, Raft nomeado `openbao_raft` \| Container Up ≠ unsealed, saudável ou cofre utilizável \|

> L19: - **C05** é infraestrutura de segredos. **A04 Core Host** é proprietário de `loadCoreSecrets`; **Manager** tem renderer e operador próprios. Não promover implementações de consumers como API pública de C05.

> L29: \| C05.DOC.01 \| **AUDITORIA PARCIAL** \| Artefatos, contratos, testes e limites reconciliados \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/REFERENCIA-TECNICA.md)

> L7: \| Responsável \| Fonte \| Contrato/consequência \|

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/OPERACAO.md)

> L7: 1. Registrar SHA/digest do serviço, TLS CA/SAN, health/initialized/sealed do ambiente **sem divulgar segredo ou topologia privada**.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/chapters/04-contratos-e-dependencias-publicas.md)

> L7: - O C05 não publica evento de negócio ou API frontend. Contratos de auth/authorizer ficam em C03/C04/A04.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
