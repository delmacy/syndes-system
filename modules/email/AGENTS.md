# AGENTS.md — Email

## Missão

Integrar uma caixa de e-mail ao fluxo de atendimento, sem criar um cliente de e-mail completo.

## Escopo

- receber;
- correlacionar contato;
- criar/atualizar conversa na Inbox;
- responder;
- manter headers/ids necessários para threading.

## Não fazer

- cliente completo de e-mail;
- campanhas;
- marketing email;
- múltiplas caixas no Basic inicial.

## Segurança

- secrets fora do domínio;
- sanitização de conteúdo;
- attachments passam pelas regras de Documents/Inbox;
- tenant isolation;
- prevenção de spoofing/confusão de identidade dentro dos limites possíveis.

## Testes

- inbound;
- outbound;
- threading;
- duplicate event;
- attachment;
- auth failure;
- tenant isolation;
- retry.
