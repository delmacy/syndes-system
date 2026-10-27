# AGENTS.md — Performance Tests

## Ambiente

Performance é isolado de development e production.

## Stress stages

50 → 200 → 500 → 1000 → 2500 tenants.

Rodar com RAM/CPU controladas para descobrir:

- baseline;
- degradação;
- primeiro gargalo;
- ponto de ruptura;
- recuperação.

## Spike

Expor o sistema a subida rápida de carga.

## Soak

Executar a capacidade operacional escolhida por 2 horas inicialmente.

## Providers

- MockWhatsAppProvider para carga massiva.
- Whatsmeow real em escala reduzida.
- MockAIProvider para medir a Syndes.
- AI real/gratuita em teste separado para latência, 429 e timeouts.

## Métricas

- p50/p95/p99;
- CPU/RAM;
- DB connections/query time;
- queue depth/age;
- WebSockets;
- AI latency;
- lost/duplicate messages;
- recovery time.

Segurança e integridade nunca podem degradar sob stress.
