---
title: "P14 · Operação e implantação"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Operação e implantação

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL RECONCILIADA — 12/11/2026.** Revisão de fontes na worktree isolada baseada no SHA `e2c5194a97d48d8a809231d7088be668604725fb`. A unidade P14 **NÃO é pacote runtime próprio**: `modules/platform-core` contém apenas `AGENTS.md`. O Core executável é distribuído por A08 Kernel, A04 Host, Control/Identity/Authorization e módulos de domínio. Nenhuma alteração de runtime, banco, permissões, plugi

> L7: O levantamento complementa os testes históricos; o CI remoto verde não aprova operação ou perfis por instância.

> L20: \| **CI integrado da baseline** \| [run 43345095065](https://github.com/delmacy/syndes-system/actions/runs/43345095065) — **24/24 jobs success** no SHA `e2c5194` \| Ambiente de CI, não deploy/restore/Product Gate \|

> L22: \| **Aceite/Operação** \| Nenhuma homologação feita nesta frente \| Release, backup/restore, service grants, rollout e Product Gate pendentes \|

> L38: 2. **CMP-03–09:** duas composições independentes, imagem mínima, checksums, entitlements por instância, ingress, worker ownership, segurança e rollback **não comprovados**.

> L56: \| 2026-11-12 \| `b452a03e`, DevServer01 \| Testes locais históricos Kernel 35, Host 63; 19 skip \| Deploy/staging/CI desse SHA \|

> L57: \| 2026-11-12 \| `e2c5194a97d48d8a809231d7088be668604725fb`, CI remoto \| [24/24 jobs success](https://github.com/delmacy/syndes-system/actions/runs/43345095065) \| Produto/restore/rollback/profile operacional \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/REFERENCIA-TECNICA.md)

> L23: \| `CoreKernel.execute(...)` \| Exige `Actor` autenticado, `TenancyPort.canAccessTenant` e `AuthorizationPort.canAccess`; nega operação indevida \|

> L53: - **Nenhum perfil de composição implantado:** `config/modules.json` é lista fixa; o plano CMP-01/02 é futuro e CMP-03–09 não está comprovado.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/OPERACAO.md)

> L31: 3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.

> L33: 5. Registrar resultado e evidência em STATUS, sem confundir merge com deploy ou aceite.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L38: 6. Em falha de membership, FGA, identidade ou infraestrutura, negar a operação protegida; a implementação do erro HTTP depende do Host.

> L82: Conforme [ADR de composição](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/ADR-COMPOSICAO-MODULAR-CORE-20261111.md), perfis por instância devem ser artefatos confiáveis imutáveis por build/deploy. Não carregar módulos a partir de requisições de usuários; não inventar comunicação cross-process sem contrato/teste/necessidade.

> L89: - **Segurança:** para ativação de perfis/workers exige Control ENABLED, FGA service grants, schema migrado com backup/restore, canário e rollback autorizados.

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/chapters/06-wbs-marcos-e-aceite.md)

> L25: 4. **Implantação/perfis:** nada habilitado, nenhum worker iniciado, nenhuma migration operacional aplicada nesta auditoria.

> L33: - Validar duas composições reais sob dois tenants, com digest, recursos, logs, rollback e aceite; não atribuir DONE a P14 antes dos gates correspondentes.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
