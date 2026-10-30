# INBOX-03 — Channel contract e fake adapter

- **Módulo/gate:** Inbox / Sprint 2.
- **Classificação:** `MVP`.
- **Owner:** OpenCode Free (NVIDIA); Codex revisa.
- **Dependência:** INBOX-02 aceito.

## Objetivo e ownership

Implementar contrato interno entre Inbox e canais e um fake determinístico de teste/demonstração. Ownership: `apps/api/src/modules/inbox/**` em arquivos de adapter/ingress/outbound e testes próprios. Não editar migrations base ou o módulo WhatsApp.

## Regras

- Receber evento inbound com `TenantContext` e channel já resolvidos por caller interno confiável; payload externo jamais escolhe tenant/database. Não manter mapa/registry de tenant em memória no processo Inbox.
- Idempotência por ID externo do evento/mensagem dentro do channel; duplicata não cria outra mensagem.
- Reorder/retry e delivery state são persistidos; falha não é reportada como sucesso.
- Resposta pública chama o adapter; nota privada nunca cruza essa porta.
- Fake adapter produz evento/resposta determinísticos, não acessa rede e não se apresenta como provider de produção.

## Aceite

- Unit/integração cobre duplicate, retry, ordering, delivery fail/recovery, mapping de ChannelIdentity, note isolation, tenant scope e audit.
- Nenhuma dependência direta de whatsmeow, Graph, SMTP ou SDK de provider aparece no domínio Inbox.
- Checks API relevantes passam; registrar outputs e diff.

## Revisão e aceite Codex — 2026-10-28

- **Estado:** aceita; INBOX-04 liberada.
- Ingress recebe `TenantContext` confiável e channel como argumentos separados do payload; identidade `ChannelIdentity` é consultada exclusivamente no database tenant resolvido pelo `TenantCrmDatabase`. Payload com `tenantId` é rejeitado antes de qualquer consulta tenant.
- Idempotência inbound persistida por `(source_channel, external_id)` em índice único parcial no database tenant; concorrência é reconciliada sem converter erros PostgreSQL não relacionados em duplicata.
- Fake adapter é selecionado somente por `INBOX_CHANNEL_ADAPTER=fake` explícito fora de `NODE_ENV=production`. Sem configuração, incluindo produção, adapter indisponível persiste falha e nunca marca `dispatched`.
- Somente o serviço de entrega de mensagens públicas chama o port outbound; notas privadas não dependem dele. Auditoria de canal é actor-less, tenant-attributed e contém apenas IDs/action/result allowlisted.
- Unitários focados da Inbox: 10 suites/73 testes; API unitários: 43 suites/270 testes; integração PostgreSQL Inbox descartável: 25/25; typecheck, lint e build passaram.
- A integração criou Control Plane + dois tenant databases com nomes descartáveis e os removeu; consulta posterior confirmou zero `inbox02_*` restante. `.env` foi apenas usado para carregar a conexão de manutenção, nunca alterado ou impresso.
- Playwright não executado; sem commit, push ou deploy.
