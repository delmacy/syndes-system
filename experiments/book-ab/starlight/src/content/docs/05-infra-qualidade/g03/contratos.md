---
title: "G03 · Contratos públicos e privados"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Contratos públicos e privados

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/STATUS.md)

> L36: 7. **Segurança de documentação pública:** não publicar credenciais, tokens, PII, endereços de administração ou configurações sensíveis.

> L40: - [ESCOPO](ESCOPO.md): missão, exclusões, regras dos agentes, matriz de contratos, critérios de testes e diagrama de mudanças.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/REFERENCIA-TECNICA.md)

> L31: - Para **imports entre módulos**, conferir `package.json#exports`, versão e owner; `docs/standards/CONTRATOS-PUBLICOS.md` é índice, não source of truth executável.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/OPERACAO.md)

> L16: - [Contratos públicos](../../standards/CONTRATOS-PUBLICOS.md).

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/chapters/04-contratos-e-dependencias-publicas.md)

> L3: **G03 não publica APIs HTTP, classes NestJS, eventos de negócio nem esquema SQL.** Seus contratos são políticas e formatos de governança.

> L5: \| Contrato de processo \| Produtor/source of truth \| Consumidor e restrição \|

> L9: \| **Superfície pública** \| `package.json#exports`, contratos tipados/HTTP/eventos e owner respectivo \| Dependente consome interface pública; não importar `src/` privado \|

> L10: \| **Solicitação de mudança** \| Issue/PRD/ADR aprovado ou proposta de edição contextual \| Issue não é aprovação; deve conter owner, diff/contrato, impacto e aceite \|

> L18: **Entradas mínimas:** `moduleId`, arquivo/tópico, objetivo aprovado, revisão base, limites, critérios de teste. **Saídas:** diff restrito, testes e comandos/resultados, risco residual, contrato afetado, commit/PR proposto e solicitação separada para consumidor externo.

> L25: - **Evento** versionado é publicado por producer autorizado e consumido por owner de destino, com idempotência, contratos e outbox quando aplicável.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
