# Test Strategy

## Commit / branch CI

Executar rapidamente:

- repository integrity;
- dependency integrity quando houver stack;
- lint;
- typecheck;
- unit tests;
- build.

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
