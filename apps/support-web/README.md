# Syndes Support Web
Frontend **independente** de Workspace e Platform Manager, sem sessão/tokens compartilhados. Não fazer deploy no mesmo origin das duas outras interfaces. Não existe `support-runtime.json` válido no bundle; o operador publica sua configuração Keycloak e tenant Syndes aprovado. Sem configuração ou login, nenhuma consulta de tickets é permitida.

## Desenvolvimento
`npm ci && npm run check && npm test && npm run build`. Em homologação, configurar runtime na raiz do servidor web a partir de `support-runtime.example.json`, substituir issuer e UUID por valores reais e provisionar client OIDC *public* `syndes-support-ui`, com PKCE S256, redirect exato no origin dedicado, token aceito pelo Host. Usar reverse proxy para `/v1/tenants` no Core Host confiável, sem expor a rede de dados. Não compartilhar armazenamento local com Workspace/Platform Manager.

As ações são as da WBS 6.1–6.4. A tela não possui indicadores inventados, botões decorativos ou dados fictícios. Novo ticket externo é associado a conversa WhatsApp **existente**, e o backend verifica a conta Syndes e o CRM. Não é um canal público de atendimento; o prospect é atendido pelo WhatsApp Syndes. Erros 401/403/409/503 são mostrados, não mascarados.

**Estado:** implementação de frontend, não homologação ou deploy. Os fluxos de autenticação/proxy/Keycloak/PG exigem E2E em homologação antes do release.
