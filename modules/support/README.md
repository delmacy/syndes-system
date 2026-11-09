# @syndes/core-support
Módulo de Cases/Tickets do tenant operacional Syndes. Contrato: `docs/product/PRD-SYNDES-SUPPORT.md`, `docs/engineering/ADR-SYNDES-SUPPORT.md` e WBS.

Migrations instaladas apenas via installer confiável e após módulos dependentes. Sem configuração `SYNDES_SUPPORT_TENANT_ID`, todas as rotas negam; sem `SYNDES_SUPPORT_WHATSAPP_ACCOUNT_ID`, abertura de casos externos nega. Nenhum grant OpenFGA ou membership de fila é criado automaticamente.

**Este branch é desenvolvimento**. Não disponibilizar a funcionários/prospects sem revisão dos testes e provisionamento manual seguro.
