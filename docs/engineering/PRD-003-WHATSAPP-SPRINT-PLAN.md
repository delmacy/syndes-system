# PRD-003 WhatsApp — Sprint plan

## Gate corrente

- Módulo: WhatsApp
- Classificação: `MVP`
- Owner de coordenação: Codex
- Dependências aceitas: Core CRM; Inbox funcional no server02/Tailscale
- Deployment: somente Tailscale; nenhuma exposição pública nesta fase

## Sprints

### WA-01 — contrato e persistência

- conexão/configuração por tenant;
- estados `disconnected`, `pairing`, `connected`, `suspended`, `error`;
- migrations descartáveis e isolamento;
- testes de autorização e unicidade.

### WA-02 — adapter e sessão

- contrato provider-neutral;
- adapter fake para CI;
- criação, pareamento, reconnect e encerramento;
- segredos segregados e logs sanitizados.

### WA-03 — inbound

- webhook/evento autenticado;
- idempotência por provider event id;
- resolução de identidade CRM;
- persistência e entrega no Inbox.

### WA-04 — outbound e UX

- envio originado por mensagem Inbox;
- estados pending/sent/failed;
- tela responsiva de configuração/status;
- erros recuperáveis e sessão preservada.

### WA-05 — integração e gate

- E2E fake provider no server02/Tailscale;
- cross-tenant e unauthorized zero;
- reconnect, duplicate delivery e billing suspension;
- revisão de segurança, observabilidade e Product Gate.

## Critérios de aceite

- uma conexão por tenant Basic;
- inbound duplicado resulta em uma única mensagem;
- outbound nunca cruza tenant nem bypassa autorização do Inbox;
- sessão/configuração sobrevivem a falha/restart;
- suspensão e reativação respeitam billing sem apagar dados;
- testes unitários, integração, migrations, segurança e E2E do fluxo completo verdes.

## Exclusões

Múltiplos números, campanhas, automações, Instagram, provider real no domínio e qualquer feature POST-MVP permanecem fora do trabalho.
