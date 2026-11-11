# FC-02.02 — Inbox HTTP + SSE com gate ENABLED

**Base:** main 1929611fc2c37c793a19292e4fb06cc80d47ef80, 2026-11-11.
**Estado:** implementado e testado em Control PostgreSQL17 descartável. NÃO ativado no Core Host operacional. FC-02.02 continua PARCIAL, faltam WhatsApp inbound/outbound/Go/worker, Support e dependências cruzadas.

## Contrato de segurança

O Core Host passa a aceitar SYNDES_INBOX_MODULE_GATE=legacy|enforce, vindo SOMENTE de configuração confiável de servidor. Ausente significa legacy até que o Control DB real tenha catálogo/entitlements/instalações/attestations. Valores inválidos negam startup. Legacy mantém JWT/FGA/SQL 002 atuais, mas NÃO aplica entitlement; é apenas compatibilidade de transição.

Em enforce, InboxDefaultContextGuard.resolve usa CoreKernel.executeModule com moduleId hardcoded inbox, resource inbox:conversations e action read. A ordem de autorização é: JWT validado no Host, tenant membership, OpenFGA por recurso, módulo Inbox efetivamente ENABLED com dependências CRM e platform habilitadas e versão/receipt aprovados, lease do banco tenant e confirmação do par Organization/Workspace. Todos os endpoints de InboxController usam InboxHost.run e seguem com FGA por ação nos serviços.

## Revalidação de SSE ao longo da conexão

- Antes de abrir o SSE: JWT, FGA, entitlement ENABLED, membership Organization/Workspace e read grant.
- No modo enforce: callback de autorização é executado antes de cada evento changed e a cada 5 segundos; confere JWT original, identidade, tenant membership, FGA, módulo e mesmo escopo Organization/Workspace.
- Resposta negada, erro de provider ou atraso maior que 3 segundos encerram o stream e removem sua inscrição. Um callback antigo não escreve no stream após seu fechamento.
- Mantém conexão máxima de 60 segundos, renovada somente por novo handshake autenticado.
- Events contêm somente invalidação sem dados do cliente. Barramento atual é local ao Host; múltiplas réplicas exigirão broker e testes próprios.
- Legacy mantém comportamento anterior; nenhum browser, contrato SSE, route, DTO ou estrutura do frontend foi alterado.

O recheck periódico reduz a janela da revogação; não é rollback de operações iniciadas, tampouco interruptor transacional de workers/outbox.

## Evidência — PG17 descartável e NestJS HTTP

Nova suíte apps/core-host/test/inbox-module-admission-pg17.test.mjs: exige variável SYNDES_AK10_DISPOSABLE_PG=AK10_DISPOSABLE_ONLY e DSN de PostgreSQL17 em 127.0.0.1/localhost, DB /postgres, usuário postgres, senha prefixada ci-only-disposable-. Teste cria e elimina banco aleatório; sem gate de ambiente, SKIP. Testa CONTROL DB PG17 real; JWT, OpenFGA e tenant DB são fakes, não E2E de identidade/DB tenant operacionais.

Cenários: A CRM+Inbox ENABLED → 200 e SSE aberto; B CRM ENABLED, Inbox somente INSTALLED → 403 para GET, POST, métricas e SSE, antes do lease tenant DB; B vira ENABLED → 200, suspenso → 403. Se CRM deixa ENABLED, entitlement vence, release é desaprovada ou Control DB cai → deny. SSE fica aberto e é revalidado várias vezes antes da suspensão, depois se encerra por recheck sem aguardar os 60s, com contador de subscribers zerado.

Validação local anterior à perda de conexão com DevServer01: Inbox 34/34 testes PASS; Core Host 84 PASS, 0 FAIL, 1 SKIP; PG17 HTTP 7/7 PASS; builds Kernel, Inbox, Host e demais módulos sem erro. A suíte Host exige npm run link-peers antes de testar, para uma instalação NestJS comum; a primeira execução do fixture teve 500 por instalações de Nest distintas, corrigido no setup. O teste de contrato de reconciliação foi fortalecido para exigir context+validator no SSE, não apenas context.

## Bloqueios de operação e próxima execução

- Control DB operacional ainda não possui o schema de catálogo/entitlements/install. Não habilitar enforce nem executar DDL sem backup e teste REAL de restore, grants mínimos, módulos ENABLED/receipts de TODOS os tenants afetados e reconciliação de ledger físico.
- Gate na entrada não cancela writes já recebidos nem protege sozinho workers ou chamadas de integração WhatsApp iniciadas pela Inbox. WhatsApp HTTP, callback, Go gateway, outbox e Support são próximos.
- Multi-org permanece bloqueado por Product Gates #21/#31 e SQL 002.
- Nenhuma alteração em frontend, GitHub Actions, proteção de main, Keycloak, OpenBao, OpenFGA, bancos operacionais ou deploy.

**Próximo corte:** FC-02.02 WhatsApp ingress/worker/Go com suspensão e outbox preservado; depois Support. Somente após enforcement servidor completo construir FC-02.03 tenant-safe capabilities e FC-01.05 menu.
