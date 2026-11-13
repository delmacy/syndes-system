---
title: "C03 · Dados e persistência"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dados e persistência

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/STATUS.md)

> L24: - **C04 / OpenFGA e C01 / Control:** autorização, membership e grants separados da autenticação. Token válido não basta para acessar dados.

> L29: 2. **P0 — isolamento entre aplicações requer E2E negativo:** provar token Manager→Workspace negado, Workspace→Manager negado e sujeito sem grant→403 com dados A/B reais; a CI sintética não fecha esse gate.

> L44: - **13/11/2026:** inspecionados arquivos versionados e estado limitado do container Keycloak, sem dados privados. Testes de documentação/contrato são evidência da revisão, **não** Product Gate.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/REFERENCIA-TECNICA.md)

> L10: \| PostgreSQL \| `infra/security-access/compose.yaml`, `infra/postgres/compose.yaml` \| Banco técnico declarado `syndes_keycloak`; **não** `syndes_control` nem dados dos tenants \|

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/chapters/04-contratos-e-dependencias-publicas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L20: - `infra/security-access/compose.yaml`: serviço Keycloak `26.8.1`, `KC_DB=postgres`, nome técnico do banco `syndes_keycloak`, configuração `keycloak.conf` montada em secret, redes declaradas de dados, autenticação, segredos e identidade Manager.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
