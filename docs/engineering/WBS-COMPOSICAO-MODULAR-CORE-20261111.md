## Frente transversal CMP — Perfis de composição do Core (decisão 11/11/2026)

**Referências:** [ADR-COMPOSICAO-MODULAR-CORE-20261111.md](ADR-COMPOSICAO-MODULAR-CORE-20261111.md) · [Issue #104](https://github.com/delmacy/syndes-system/issues/104) · [Catálogo #102](https://github.com/delmacy/syndes-system/issues/102).

**Objetivo:** permitir `Core Host + subconjunto de módulos` por instância, sem forks por cliente, preservando hexagonal/ports-adapters e o monólito modular como primeiro modo de execução. **Estado:** parcialmente suportado pelo Kernel/loader atual, profiles de instância ainda não implementados. Não é autorização de instalação nem deploy.

| Ordem | Entrega | Dependência | Situação |
|---|---|---|---|
| CMP-01 | Contratos Kernel/Host/Adapters e matriz de dependências documentados e testados | Kernel e Host atuais | PEND |
| CMP-02 | Schema de manifesto de composição e validador offline confiável | CMP-01 | PEND |
| CMP-03 | Dois perfis locais selecionáveis sem mudar código de domínio | CMP-02 | PEND |
| CMP-04 | Build reprodutível por perfil e imagem mínima | CMP-03, frente de CI | PEND |
| CMP-05 | Gating triplo: perfil da instância + ENABLED tenant + FGA | CMP-03, AK-10 | BLOQ |
| CMP-06 | Deploy, ingresso, segredos e rollback por instância | CMP-04–05, infra | BLOQ |
| CMP-07 | Ports/adapters cross-process somente para casos concretos | Necessidade comprovada | CONDICIONAL |
| CMP-08 | Ownership de workers e prevenção de concorrência | Event Bus operacional, CMP-06 | BLOQ |
| CMP-09 | Homologação de dois perfis / dois tenants / segurança | CMP-04–08 | BLOQ |
| CMP-10 | UI opcional no Manager para composições | Product Gate posterior | P2 |

**Sequência executiva preservada:** (1) plataforma/contratos e testes; (2) Control/instalador/Event Bus; (3) jornada WhatsApp→Inbox→CRM→Service; (4) frontends reais; (5) módulos restantes do MVP; (6) perfis dedicados homologados; (7) release com backup/restore completo. O Core pode receber CMP-01/02 antes do marco 3, mas profiles completos **não bloqueiam** integração do MVP. Manter até três entregas ativas em todas as frentes.
