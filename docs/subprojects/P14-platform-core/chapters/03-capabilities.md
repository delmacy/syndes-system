## 3. Capabilities da plataforma: implementadas, distribuídas e planejadas

| Capacidade | Implementação/owner verificável | Limite do estado |
|---|---|---|
| Contratos de tenancy/autorização | **A08** `contracts.ts`, `kernel.ts` | Interface de Kernel, não enforcement universal automático |
| Registro/dependências de módulos | **A08** `module-registry.ts`, `plugin.ts` | Rejeição de ciclos/ID, sem marketplace ou seleção dinâmica |
| OIDC, FGA, banco e segredos | **A04** Host adapters + C03/C04/C05/Infra | Enforcement e secrets no Host; P14 não tem runtime |
| Catálogo e ciclo de vida | **A08** `module-catalog.ts`/`module-lifecycle.ts`; **A04** `module-catalog.ts`, `module-lifecycle.ts`, `module-effective-access.ts` | Catalog/ENABLED depende do Control Plane real e do ponto de entrada |
| Trusted Tenant DB/Transaction | **A08** `TrustedTenantDatabaseProvider` e `TrustedTenantTransactionProvider`; **A04** `tenant-database.ts` | Consulta não é transação; publicação de evento exige pinning |
| Events e controle | **A08** `platform-events.ts`/`control-plane-events.ts`; **A04** publisher/dispatcher/worker opt-in | Schema e scripts existem; sem worker/scheduler automático homologado |
| Plugin API composition | **A04** `module-host.ts`, `main.ts`, `config/modules.json` | Lista fixa de cinco plugins de produto; pacote `service` está na dependência mas não no loader |
| Componentes compartilhados de frontend | **A07** `packages/front-shared`; **A01/A02/A03** seus aplicativos | Visuais compartilhados sem sessão/token/contexto misturados |
| Perfis imutáveis por instância | CMP-01–03 no ADR/WBS de composição | **Planejado, não implementado**; loader fixo não é manifesto de perfil |
| Builds por perfil, grants/entitlements, multi-host | CMP-04–09 | **Não homologados**; exigem imagens, isolamento, ownership e testes por ambiente |
| Painel de composição | CMP-10 opcional | **Não existe frontend P14** |

### Evidências concretas

- `packages/core-kernel/package.json`: `@syndes/core-kernel` privado, Node `>=22`, TypeScript, `exports["."]` para `dist/index.js` e `dist/index.d.ts`. Não há licença/SDK público lançado.
- `ModuleRegistry` ordena dependências de modo determinístico, rejeitando IDs inválidos, versões inválidas, schemas reservados, duplicados, ciclos e dependências ausentes.
- `CoreKernel.start` mantém rejeição de inicialização para impedir retry que repetiria efeitos. `execute` combina membership com autorização; `executeModule` adiciona acesso ao módulo por port opcional.
- `apps/core-host/config/modules.json` contém **CRM, Inbox, WhatsApp, Organizations e Support**. Não inclui `service-management`, embora `apps/core-host/package.json` o liste como dependência; não declarar Serviço montado no runtime.
- CI [43345095065](https://github.com/delmacy/syndes-system/actions/runs/43345095065), SHA `e2c5194`: **24/24 jobs success**, incluindo Kernel, Host, plataforma e módulos selecionados. Isto é execução de teste de GitHub Actions, não evidência de release.

**Capacidades P14 não comprovadas:** perfil de composição por instância, dois Hosts com distintos módulos, cross-process generic ports, worker operacional, migration real/restore e Product Gate. Não transferir implementações de A04/A08 para P14.
