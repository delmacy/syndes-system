---
title: "Q01 · Operação e implantação"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Operação e implantação

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/STATUS.md)

> L14: \| **Backup/restore e RC** \| Restore de fixture e scripts de preflight presentes no CI \| Restore de ambiente operacional, rollback e RPO/RTO **não verificados** \|

> L31: 2. **Provas descartáveis versus operação real:** PostgreSQL, OpenFGA, Keycloak, OpenBao e restore testados em CI não constituem restore/rollout operacional.

> L33: 4. **Performance/RC:** resultados medidos, RPO/RTO, restore, rollback e aceites de produto permanecem não comprovados.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/REFERENCIA-TECNICA.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/OPERACAO.md)

> L31: 3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.

> L33: 5. Registrar resultado e evidência em STATUS, sem confundir merge com deploy ou aceite.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L30: \| Integração de identidade \| Keycloak, OpenFGA, OpenBao, JWT/Host \| Containers CI, realms/stores e secrets de fixture \| Grants, tokens e DNS da operação \|

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/chapters/06-wbs-marcos-e-aceite.md)

> L20: \| Backup/restore de operação \| Restore/rollback medido no ambiente-alvo, aceite \| **Não comprovado** \|

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
