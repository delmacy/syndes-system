# Gate de QA e revisão Syndes

Selecione os itens aplicáveis ao risco da entrega. Ausência de código ou ambiente deve ser registrada como evidência indisponível, não presumida como sucesso.

## Conformidade de produto

- requisito pertence ao módulo e ao MVP correntes;
- regras de negócio e critérios de aceite estão rastreáveis;
- UX e jornada de aceite estão completas quando aplicável;
- nenhum comportamento pós-MVP foi antecipado.

## Arquitetura e dados

- monólito modular e limites do módulo foram preservados;
- não há source of truth duplicado;
- tenant é resolvido server-side;
- Control Plane e bancos de tenant respeitam a separação aprovada;
- migrations são reversíveis ou possuem recuperação documentada e são testadas em banco descartável;
- concorrência, idempotência e integridade foram consideradas conforme o fluxo.

## Segurança

- autorização ocorre no backend e segue least privilege;
- IDs manipulados não atravessam tenants;
- inputs, uploads e webhooks são validados conforme aplicável;
- logs e evidências não contêm secrets, tokens ou dados financeiros sensíveis;
- operações críticas produzem auditoria;
- qualquer exposição cross-tenant resulta em `CORREÇÕES NECESSÁRIAS` ou `BLOQUEADO` para release.

## Testes e qualidade

- testes existentes permanecem preservados;
- lint, typecheck, unit e build passam quando a stack os oferece;
- integração cobre persistência, contratos, erros e timeouts relevantes;
- testes de isolamento e autorização cobrem o backend;
- E2E prova a jornada crítica, não apenas renderização;
- mocks externos cobrem erro, timeout e duplicação;
- flakiness não foi mascarada por retries ilimitados.

## Operação e evidência

- erros possuem tratamento e diagnóstico suficiente;
- logs e métricas permitem observar a jornada crítica;
- documentação e configuração acompanham a mudança;
- árvore Git não contém arquivos temporários, secrets ou mudanças fora do escopo;
- CI foi conferido no commit revisado;
- evidências citam comandos, resultados, commit e ambiente.

## Decisão

- `ACEITO`: requisitos e gates aplicáveis foram provados; riscos residuais estão registrados e toleráveis.
- `CORREÇÕES NECESSÁRIAS`: há falhas acionáveis dentro do escopo; liste cada correção, evidência esperada e responsável.
- `BLOQUEADO`: somente decisão humana não inferível, requisito irreconciliável, permissão/credencial ausente ou dependência externa inacessível impede progresso.

CI verde é evidência necessária quando configurada, mas nunca suficiente para `ACEITO`.
