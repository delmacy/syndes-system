# I09 — Whatsmeow runtime | Operação

> **RUNBOOK DOCUMENTAL NÃO HOMOLOGADO.** Revisão estática de 13/11/2026, `main` a1754ccc. Não executar operações no ambiente com base apenas neste inventário.

## Condições declaradas
[README](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/gateway/whatsmeow/README.md) declara sidecar interno, bind `127.0.0.1:19083` por padrão, store PostgreSQL separado, quatro nomes de variáveis obrigatórias e callback autenticado. Não expor publicamente.

## Sequência para homologação (não executada)
1. Confirmar owner P03, versão Go, build, configuração sem revelar segredos e conectividade restrita.
2. Validar PostgreSQL de sessão, backup, rollback e alterações SQL de inicialização de [main.go](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/gateway/whatsmeow/main.go) em ambiente descartável.
3. Executar testes Go, testes de HTTP por conta, envelope callback, idempotência, limite 40/min e concorrência; registrar SHA, logs sanitizados e resultado.
4. Verificar autenticação entre Nest e sidecar, isolamento tenant/conta, restauração e reconciliação de envios incertos.
5. Validar smoke real, operação, observabilidade e Product Gate com aprovação explícita do owner.

## Bloqueios
Nenhum passo acima foi executado nesta auditoria. `GET /healthz` não é prova de conexão WhatsApp. Não promover a homologado sem evidência independente.

## Fontes
[STATUS](STATUS.md) · [Referência técnica](REFERENCIA-TECNICA.md) · [WBS](EVOLUCAO.md) · [P03](../P03-whatsapp/OPERACAO.md).
