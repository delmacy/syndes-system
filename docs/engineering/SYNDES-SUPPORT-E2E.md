# Syndes Support — E2E de navegador em ambiente descartável
Status: automação proposta; nenhuma homologação em dados reais ou deploy.

## Limites do teste
`.github/workflows/support-browser-e2e.yml` sobe **serviços exclusivamente do runner GitHub Actions** (PostgreSQL 16, Keycloak 26.8.1 com TLS efêmero, OpenFGA 1.22.1 em memória) e encerra tudo ao final. Os IDs, usuários e senhas fixos em `apps/support-web/e2e/syndes-support-realm.json` são **dados sintéticos exclusivos do teste**, nunca valores de produção. O harness `apps/core-host/test/support-e2e-server.mjs` recusa por código qualquer URL fora do banco `syndes_support_e2e`, issuer `localhost:8443/realms/syndes-support-e2e` e OpenFGA local `127.0.0.1:18080`; escuta HTTP apenas em `127.0.0.1:4180`.

## O que é exercitado pelo Playwright
1. O navegador visita frontend isolado, faz login **real** Keycloak por authorization code + PKCE S256 com certificado temporário; backend verifica RS256/JWKS/audience.
2. PostgreSQL real recebe as migrations existentes e Support, contexto Syndes/CRM, conta WhatsApp sintética e conversa Inbox sintética.
3. OpenFGA real executa permissões por recurso e ator usando o modelo efetivo do repositório; PgMembership consulta tenant registry de fixture efêmera.
4. Usuário funcionário abre solicitação interna. O agente da fila vê a solicitação, registra nota e muda estado. Solicitante acompanha mudança sem acessar nota privada.
5. Atendente autorizado cria chamado externo a partir da Inbox real com CRM e conta WhatsApp Syndes vinculada; acesso externo de usuário interno sem grant é negado.
6. Rejeição HTTP 401 para acesso anônimo e 403 para usuário com JWT legítimo, mas sem membership/grants.

## Limitações transparentes
É homologação automatizada em **topologia descartável**, não deployment e não aceitação manual do operador. O registry de tenant e banco funcional são fixtures em um PostgreSQL efêmero, não a infraestrutura real segregada por tenant; testes de isolamento físico do Core Host/controle continuam separados na CI existente. Não há envio de mensagens reais, emparelhamento do telefone Whatsmeow, migração em tenant comercial, backup/restore de dados operacionais, teste de resiliência de múltiplas réplicas nem aceitação visual humana. Portanto o Product Gate #31 permanece fechado.

## Execução
O workflow instala dependências travadas, Chromium headless e serviços em portas locais exclusivas. O runtime UI `support-runtime.json` é gerado **apenas** no runner e está no `.gitignore`. `npm test` mantém só os testes unitários da interface; `npm run test:e2e` exige os serviços descartáveis e não é executável com credenciais reais. Falhas não são neutralizadas por skip; evidência sintética Playwright é retida por sete dias quando ocorrer falha.
