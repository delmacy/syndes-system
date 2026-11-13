---
title: "C04 · APIs e endpoints"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# APIs e endpoints

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/STATUS.md)

> L18: - **A04 Core Host:** `FgaPermission.canAccess` faz `POST /stores/{store}/check`, exige decisão booleana; `TenantEventWorkerAdmission.authorize` combina ENABLED, escopo tenant/org/workspace e grant de serviço.

> L19: - **A06 Account API:** `createFgaWriteAuthorizer` usa identidade de usuário e recurso hash do tenant; não confundir com permissão de operador global.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/REFERENCIA-TECNICA.md)

> L13: \| A06 Account API \| `apps/account-access-api/src/auth.mjs` \| Autorização para delegação de roles sem confiar em grant do browser \|

> L17: `infra/security-access/fga-model.json` não contém classes TypeScript, `package.json` ou endpoints de negócio próprios. O provedor possui endpoint externo OpenFGA, mas as chamadas listadas abaixo são **implementadas em outros owners**.

> L35: \| A04 \| `FgaPermission.canAccess` \| `POST /stores/{store}/check`, usuário `user:{sub}`, `can_read/can_write`, `resource:{sha256(tenant\|resource)}`; falha ou resposta inválida nega por exceção \|

> L65: - Testes: `apps/core-host/test/adapters.test.mjs`, `platform-event-service-grant.test.mjs`, `platform-event-service-grant-fga.test.mjs`, `apps/account-access-api/test/auth.test.mjs`. Incluem negativas e instância in-memory/descartável, não configuração runtime persistente.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/OPERACAO.md)

> L7: 1. Verificar versão/digest OpenFGA, health e config ativa com operador autorizado; registrar metadados seguros, sem divulgar endpoint privado, tokens, IDs de recursos ou tuples.

> L11: 5. Exigir sign-off de C01/C03/C04/A04/A06/C06, testes CI e testes HTTP/PG17/OpenFGA no ambiente-alvo por SHA antes de registrar Product Gate.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/chapters/04-contratos-e-dependencias-publicas.md)

> L3: Contrato externo OpenFGA: `POST /stores/{store}/check` com `tuple_key`, retornando `allowed` booleano. **Store/model ID e grants efetivos não verificados.**

> L11: Esses símbolos pertencem aos packages citados, **não** constituem classes/API pública de `infra/security-access/fga-model.json`.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
