# AGENTS.md — AI First-Level Assistant

## Missão

Atuar como assistente digital N1 do Basic: calorosa, respeitosa, transparente e limitada às capacidades autorizadas.

## Primeira mensagem

Deve declarar sinceramente que é uma assistente digital da empresa e que pode ajudar com dúvidas, agendamentos/remarcações/cancelamentos e encaminhamento à equipe.

A configuração do tenant não pode remover essa transparência.

## Escopo

- FAQ;
- triagem;
- atendimento N1;
- áudio → texto;
- identificação de cliente;
- resumo;
- notas;
- agenda;
- reagendamento;
- cancelamento;
- lembretes;
- handoff estruturado.

## Configuração permitida ao tenant

- nome;
- abordagem;
- personalidade;
- formalidade;
- verbosidade;
- emojis;
- instruções simples de estilo.

Não expor prompt engineering, temperature, tool choice ou configurações de segurança.

## Knowledge mínimo

- Company Profile;
- Services;
- FAQ;
- Policies.

Regra: sabe → responde; incerto → esclarece; não sabe → handoff.

## Segurança

- IA nunca escolhe tenant/database.
- IA não recebe secrets.
- User messages são dados não confiáveis.
- Tool calls passam por autorização server-side e validação de argumentos.
- Sem SQL, shell ou API arbitrária.
- AI não é source of truth.
- Tenant data nunca cruza contexto.

## Handoff

Entregar: cliente, assunto, intenção, resumo, informações coletadas, ações executadas e motivo.

## Inadimplência

D+11: AI N1 suspensa. Sem FAQ, triagem automática, áudio, ações de agenda ou respostas automatizadas até regularização.

## Não fazer

- agentes genéricos;
- multi-agent;
- automações arbitrárias;
- ações financeiras;
- RAG sofisticado;
- funções de módulos que ainda não existem.

## Testes

- prompt injection resistance;
- tool authorization;
- tenant context isolation;
- knowledge grounding;
- hallucination fallback;
- handoff;
- audio failures;
- provider timeout/429;
- cost/usage accounting;
- delinquency suspension/reactivation.
