# Test Strategy

## Commit / branch CI

Executar rapidamente:

- repository integrity;
- dependency integrity quando houver stack;
- lint;
- typecheck;
- unit tests;
- build.

## Desenvolvimento incremental

- Implementar os testes relevantes na mesma fatia em que cada componente é criado ou alterado; não deixar a cobertura para o fim do módulo.
- Para cada comportamento, escolher o nível adequado: unitário para regras isoladas, integração para persistência/API/contratos e componente ou E2E para jornadas de UI.
- Uma fatia não está pronta para revisão sem seus testes e evidência local, mesmo que a suíte geral continue verde.
- Preservar os testes existentes; corrigir implementação ou expectativas justificadas, nunca enfraquecer testes apenas para obter CI verde.

## E2E de frontend

- E2E é um gate opt-in de alto custo: apontar quando for necessário para aceite, mas não executá-lo durante o desenvolvimento normal, em cada fatia ou como parte do CI rápido.
- Quando a execução E2E for solicitada ou necessária para um gate, usar um script Playwright headless que grave logs e resultados em artefatos legíveis; revisar esses outputs para reportar sucesso, falhas e passos afetados.
- Não validar a jornada dirigindo manualmente o frontend ou inspecionando-o visualmente. A evidência deve vir da saída reproduzível do script Playwright.
- Os testes unitários, de integração e de componente continuam sendo criados e executados junto com cada fatia; esta regra de custo se aplica ao E2E de frontend.

## Pull Request CI

Além do anterior:

- integration tests;
- migrations;
- tenant isolation;
- authorization;
- contract tests;
- security checks;
- production build.

## Release Candidate

Executar em ambiente `performance` isolado:

### Stress

Degraus:

50 → 200 → 500 → 1000 → 2500 tenants.

Hardware deve permanecer controlado durante cada rodada.

### Spike

Subida rápida de carga para observar connection storms, filas, pool starvation, memória e recuperação.

### Soak

Carga operacional escolhida por no mínimo 2 horas inicialmente.

### Provedores

- WhatsApp massivo: MockWhatsAppProvider.
- Whatsmeow real: escala reduzida separada.
- AI: primeiro MockAIProvider; depois providers/modelos reais para medir latência, 429, timeout e disponibilidade.

## Invariantes

Nunca aceitar degradação em:

- isolamento entre tenants;
- autorização;
- integridade de registros;
- desaparecimento silencioso de mensagens.

Latência pode degradar sob stress; segurança e integridade não.
