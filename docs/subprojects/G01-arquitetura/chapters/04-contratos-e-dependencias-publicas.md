## 4. Contratos e dependências públicas

### G01 como unidade documental

**Entradas:** ADRs, AGENTS, inventário do catálogo, documentação de owner, WBS, evidências de CI/ambiente e propostas de mudança. **Saídas:** decisões rastreáveis, limites de responsabilidade, diagramas, matrices de conformidade, pendências e links para a fonte. **Não há export TypeScript, API HTTP ou evento produzido pela G01.**

### Contratos operacionais identificados em owners

| Responsável real | Fonte no código | O que o contrato delimita |
|---|---|---|
| A08 Core Kernel | `packages/core-kernel/src/index.ts`, `src/contracts.ts`, `src/module-registry.ts` | `CoreKernel`, `ModuleRegistry`, `TenancyPort`, `AuthorizationPort`, `TrustedTenantDatabaseProvider`, `TrustedTenantTransactionProvider`, `ModuleAccessPort` |
| A04 Core Host | `apps/core-host/src/module-host.ts`, `config/modules.json` | `loadInstalledPlugins`, módulos confiáveis e validation de dependências/rotas de assets |
| P01 CRM | `modules/core-crm/package.json` | Export `.` e `./plugin`; detalhes do domínio pertencem ao P01 |
| P02 Inbox | `modules/inbox/package.json` | Pacote **`@syndes/core-inbox`**, exports `.` e `./plugin` |
| P03 WhatsApp | `modules/whatsapp/package.json` | Pacote `@syndes/whatsapp`, múltiplos exports de contracts/bridge/plugin; verificar compatibilidade antes de importar |
| C06 Event Platform | `packages/core-kernel/src/platform-events.ts`, `control-plane-events.ts` | Envelopes e validação tipados; declaração ≠ entrega operacional |
| C01/C03/C04/C05 | ADRs de Control, Keycloak, OpenFGA e OpenBao | Metadados e identidade, relação/recurso e segredos; contratos de infraestrutura e políticas, não API pública da G01 |

**Regra:** `export` em um arquivo não implica superfície pública do pacote. Confirmar `package.json#exports`, consumidor, compatibilidade, autenticação e isolamento antes de integrar. O Host deve injetar ports/consumidores; evitar imports de caminhos `src/` privados de outros owners.

### Conflitos/reconciliações documentais identificados

1. [CORE-FRAMEWORK-ARCHITECTURE.md](../../../engineering/CORE-FRAMEWORK-ARCHITECTURE.md) ainda usa `apps/core-api` como *future composition root* em diagrama histórico, mas o Host do checkout é `apps/core-host`. **Atualizar a referência antiga em revisão própria**, preservando contexto e aprovação original.
2. [CONTRATOS-PUBLICOS.md](../../../standards/CONTRATOS-PUBLICOS.md) contém `@syndes/inbox` como rótulo **a verificar**; o `package.json` atual do P02 declara `@syndes/core-inbox`. O owner P02 deve atualizar a ficha normativa e conferir consumidores.
3. [ADR Kernel/schemas](../../../engineering/ADR-ACCOUNT-KERNEL-MODULE-SCHEMAS-20261110.md) descreve schemas por módulo como evolução incremental, enquanto SQL histórico ainda utiliza `public`. **Não afirmar isolamento por schema aplicado** até a migração e os grants serem verificados em banco real.
4. [ADR composição modular](../../../engineering/ADR-COMPOSICAO-MODULAR-CORE-20261111.md) prevê perfis de implantação, mas a fonte examinada só inclui config estática. **Perfis distintos não comprovados**.

**Dependências de G01:** documentos versionados sob `docs/engineering`, catálogo, ADRs e resultados de auditoria dos owners; nenhuma dependência runtime obrigatória identificada para a unidade documental.
