# PRD-003 — WhatsApp MVP

## Estado

- Classificação: `MVP`
- Módulo corrente após o gate operacional do Inbox
- Escopo: um número WhatsApp por tenant Basic
- Provider real fora do domínio; integração por adapter

## Objetivo

Permitir que um tenant configure uma única conexão WhatsApp, receba mensagens no Inbox e envie respostas autorizadas pelo Inbox.

## Incluído

- configuração e estado da conexão por tenant;
- pareamento/sessão com o provider através de adapter;
- inbound autenticado, validado e idempotente;
- vínculo da identidade WhatsApp à pessoa canônica do CRM;
- entrega da mensagem inbound no Inbox;
- despacho de respostas outbound originadas no Inbox;
- reconnect seguro sem apagar sessão/configuração;
- auditoria, logs sanitizados e métricas operacionais;
- suspensão/reativação conforme as regras de billing aprovadas.

## Excluído

- múltiplos números por tenant;
- Instagram, Telegram ou outros canais;
- campanhas, automações e broadcast;
- provider real diretamente no domínio;
- mídia além do que o Inbox já suporta como anexo;
- mobile nativo.

## Regras obrigatórias

- tenant/database nunca são selecionados pelo cliente;
- webhook/evento deve ser autenticado e idempotente;
- mensagens duplicadas não podem criar registros duplicados;
- falha de provider não pode apagar sessão nem mensagens persistidas;
- outbound somente por ação autorizada do Inbox;
- logs não podem conter tokens, QR, credenciais ou conteúdo sensível desnecessário;
- uma conexão ativa por tenant Basic;
- suspensão por billing impede envio/recebimento operacional sem apagar dados.

## Product Gate

Aceitar somente após integração demonstrável entre configuração → sessão → inbound → Inbox → outbound → reconnect, com isolamento de tenant, idempotência, autorização, observabilidade e testes automatizados verdes.
