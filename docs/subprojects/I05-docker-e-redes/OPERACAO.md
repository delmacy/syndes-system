# I05 — Docker e redes | Operação

> **RUNBOOK DE VERIFICAÇÃO, NÃO AUTORIZAÇÃO DE MUDANÇA.** Em 13/11/2026 foram observados 16 containers Up e bridges Syndes/Komodo, sem `docker inspect`, sem leitura de secrets e sem executar Compose. O serviço Up não prova readiness.

## Gate de leitura autorizado

1. Registrar SHA da fonte e owner de cada stack; distinguir I05 de I06 Traefik, I07 Tailnet, I08 Komodo e I12 hardening.
2. Planejar validação de `docker compose config --quiet` **em cópia isolada** e sem importar arquivos secretos; o manifesto Manager exige variáveis e arquivos operacionais, portanto não executar cegamente no host.
3. Com autorização operacional, coletar **somente campos sanitizados** de rede, `internal`, portas publicadas, privilégios, health e labels; nunca registrar env, tokens, mounts privados, IPs privados ou caminhos sensíveis.
4. Conferir se topologia efetiva corresponde ao Compose da revisão analisada; testar negativas de comunicação entre domínios em ambiente segregado, com plano de rollback.
5. Requerer evidências de backup/restore e custódia de volumes dos respectivos owners. Só após aceites registrar I05 como homologado.

## Bloqueios

Não existe evidência de isolamento efetivo, rede de produção ou inventário completo de todos os stacks. O job `openfga-migrate` não foi executado. Nenhuma configuração, secret, container, volume, porta ou firewall foi modificado.

[Status](STATUS.md) · [Referência](REFERENCIA-TECNICA.md) · [Sprint](SPRINT.md) · [Evolução](EVOLUCAO.md) · [Projeção](PROJECAO.md) · [Implementação](IMPLEMENTACAO.md) · [Alteração](ALTERACAO.md).
