## 4. Contratos e dependências públicas da Q07

### Interfaces de processo e formatos

**Q07 não mantém API HTTP, schema PostgreSQL, controller, port NestJS nem eventos de negócio**. Seus contratos executáveis são **comandos, JSON de planejamento, YAML de CI e exit codes**, consumidos pelo GitHub Actions.

| Interface | Entrada | Saída / efeito | Contrato de falha |
|---|---|---|---|
| `selectSuites(changedPaths, available, mode)` | Paths modificados, suites instaladas, `impact/full` | Lista de objetos `{suite,node}` conforme catálogo | `Unknown CI mode` e caminhos desconhecidos → full |
| `installedSuites(base)` | Árvore de repositório e markers | Suites instaladas identificadas por lockfile/go.mod/`.env.ci` | Não declarar uma suite disponível sem marker |
| CLI `plan.mjs full` | `main` e arquivo alterado opcional | JSON `{"include":[...]}` com suites | `noop` só quando seleção vazia; governance sempre |
| CLI `plan.mjs impact <changed-file>` | Arquivo newline-delimited de paths | Matriz de impacto para GitHub Actions | Ausência de pathfile em modo impact → erro |
| `bash run-suite.sh <suite>` | ID de suite conhecida | `npm check/test/build`, Go, PG descartável ou scripts especializados | Suite não reconhecida → exit 2; teste falho → exit !=0 |
| `parity.test.mjs` | YAML e scripts locais | Node Test com assertions de paridade e workflows permitidos | Novo workflow não classificado ou perda de gate → teste falha |
| `syndes-ci.yml` | Push/PR/merge group/dispatch | Foundation, regressions/paridades, Gate | Job necessário com failure/cancel/skip → gate falha |

### Contrato de PG17 da suíte Serviço

O `service-management` utiliza container de teste **descartável** com imagem `postgres:17-alpine`, label `syndes.disposable=funnel-mvp-pg17`, nome e porta fixa de fixture, e marcador `SYNDES_FUNNEL_DISPOSABLE=FUNNEL_PG17_ONLY`. O teste `service-funnels-pg17.test.mjs` exige explicitamente esse ambiente e nega casos de uso fora de localhost. O runner controla o lifecycle com `trap` de limpeza.

**Observação:** o valor da senha do teste é sintético, limitado a runner descartável. Não usar esse DSN, volume ou container para dados reais e não publicar credenciais operacionais.

### Matrizes de dependência e owners

| Mudança em owner | Suite obrigatória adicional | Justificativa |
|---|---|---|
| Kernel/Organizations/Host/Infra/CI | Todas as suites disponíveis | Efeito amplo sobre segurança, tenancy, contratos e runtime |
| CRM | CRM + Inbox + Serviço + Host + Workspace + Support | Consumidores e relacionamentos do atendimento |
| Inbox | Inbox + Serviço + WhatsApp TS + Host + Workspace + Support | Contexto da conversa e protocolo |
| Serviço | Serviço + Inbox + Host + Workspace | Plugin, inspector de conversa e frontend candidato |
| WhatsApp Go | WhatsApp Go/TS + Inbox + Host + Workspace | Transporte/protocolo/mensagens |
| Docs-only | Foundation e publisher Docs conforme paths | Não selecionar regressões de negócio por documentação pura |
| Unknown path | Todas as suites disponíveis | Não ignorar novo componente |

**Fronteira de código:** Q07 pode alterar scripts/workflows de CI e seus testes. As assinaturas `ServiceFunnelService`, `InboxService`, Core, schema `service` e endpoints continuam pertencendo aos módulos. A seleção de teste **não habilita** um módulo operacional.
