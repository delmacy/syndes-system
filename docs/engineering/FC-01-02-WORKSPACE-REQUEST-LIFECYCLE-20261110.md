# FC-01.02 — Cancelamento de requisições e SSE ao trocar contexto

Data: 2026-11-10. Base: main f1166e9b9d82a258b0b70517d0cd81635a096d09.
Estado: código e testes de fixture locais, sujeito à Syndes Mainline CI; não implantado.

## Objetivo, escopo e risco

Uma resposta de CRM/Inbox/WhatsApp pertencente a Organization A não pode atualizar a interface de B depois da troca. Um SSE do contexto anterior não pode disparar atualizações na nova Organization, e um 401 tardio do contexto antigo não deve derrubar a sessão ainda válida. Ocultar a view sem cancelar o transporte não basta.

## Implementação

- TenantApi mantém um AbortController por instância. Toda chamada HTTP de request — GET ou mutation — e o export CSV usam o signal; watchInbox combina o signal externo do hook e o ciclo de vida da instância com AbortSignal.any.
- Ao terminar contexto, dispose() é idempotente: aborta transportes, marca a instância como inativa e descarta referências filhas. O cliente root do usuário é o único que lê Organizations/Workspaces; cada contexto exibido recebe um forWorkspace(selection) próprio, inclusive legacy null.
- Fechar o root ao trocar de principal/logout aborta transitivamente todos os clientes de workspace derivados. Trocar de Workspace fecha o cliente anterior antes do novo paint, via layout-effect cleanup.
- Request verifica o status ativo antes de iniciar e depois de fetch, depois da leitura do body (inclusive erros 401/403/503) e antes de devolver dados. Isso cobre mocks/adapters que ignoram AbortSignal: resposta tardia não é entregue e não chama o logout do novo contexto.
- SSE combina ambos os signals, para quando um deles aborta, e checa o estado antes de processar cada frame/emitir invalidações. Continua usando JWT Bearer do tenant e a mesma URL.
- Registry visual de quatro views, shell, TenantApi public API, módulos existentes e backend NestJS permanecem inalterados. Mantemos SQL 002 e fallback de instalação single-context até o gate multi-org.

### Limite importante das mutações

**Cancelar um fetch POST/PATCH/DELETE não reverte necessariamente uma escrita que o servidor já recebeu.** O cancelamento impede exibir uma resposta antiga e interrompe processamento local, mas não garante rollback ou exactly-once. Operações de escrita existentes continuam necessitando autorização servidor-side, idempotência e verificação de estado antes de eventual retry. Não prometer "não houve escrita" apenas porque o browser recebeu AbortError.

### Limite importante da autorização

Isolamento de transporte não é isolamento no servidor: nenhum endpoint/worker ganha entitlement por este patch. O gate ModuleAccessPort e FGA permanecem obrigatórios. Dados de outro tenant não podem ser consultados por headers forjados. Owner e papel de conta não dão acesso ao CRM por si. Este patch não ativa multi-org e não substitui o Product Gate #31.

## Evidências de validação

1. npm run build --prefix apps/workspace-web (tsc/Vite) e npm test --prefix apps/workspace-web: 39/39 testes, incluindo requests cujo mock ignora abort, 401 tardio, leitura lenta de body, CSV, mutation e SSE. Root logout aborta filhos. Novo context client permanece isolado do antigo.
2. npm run lint --prefix apps/workspace-web: 0 erros, 15 avisos já presentes no baseline (outros arquivos). Nenhum warning novo em App/context/api.
3. node apps/workspace-web/tests/shell-context-browser.mjs contra preview descartável 127.0.0.1:18095: Playwright com Keycloak/API mockados, duas Organizations/Workspaces, GET A retido, troca para B, resposta A liberada, nenhum contato A reaparece, SSE B → A reabre no contexto correto, logout limpa view/seleção e unknown hash retorna Overview.
4. SYNDES_UI_ORIGIN=http://127.0.0.1:18095 node apps/workspace-web/tests/anonymous-smoke.mjs: guard de CRM/Inbox e navegação anônima sem JS errors.
5. Fixtures locais NÃO equivalem à prova de revogação real no Core Host, OpenFGA ou JWT. CI no SHA integrado é gate distinto.

## Pendências fora desta fatia

- FC-02.01/02/03: mapear handlers Nest e workers que ignoram executeModule, migrá-los com Control DB versionado/backfill e disponibilizar read model tenant-safe para frontend. Não liberar rotas por simples menu.
- Product Gate #21/#31, SQL 002, credenciais de tenant real, WhatsApp inbound/outbound e E2E contra backend real.
- Frontend do Manager e seus tokens/roles/deploy continuam independentes. Nenhum middleware, proxy ou backend novo.

## Operação

Alteração limitada ao Workspace React e documentação. Sem migrations operacionais, alterações de GitHub Actions, proteção de main, Keycloak, OpenBao, OpenFGA, Tailnet, banco real ou deploy. Worktree principal com alterações de Inbox de outro chat preservada.
