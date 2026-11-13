# G05 Operação e suporte — checkpoint de auditoria (2026-11-13)

Base GitHub main observada antes da escrita: `077eef7b81ceed4ed49c232d11cd408f2c5ef531`. Catálogo `catalog/work-units.json` blob `d2aa27a13e30df16a28812f965577914430728b3`: G05, `distributed`, path `docs/engineering/SYNDES-SUPPORT-RUNBOOK.md`. Ownership documental não implica implantação.

## Evidência por arquivo e blob
- `docs/engineering/SYNDES-SUPPORT-RUNBOOK.md` `332db926989b01a1eb71dcdcdbe4020e4c129b64`: proposta de homologação, exige tenant operacional exclusivo, cliente OIDC separado, autorização OpenFGA, digest imutável, migration restrita e smoke negativo. Contém exemplos SQL operacionais; **nenhum SQL executado**.
- `docs/product/PRD-SYNDES-SUPPORT.md` `e629057acf81c55b55f1c9f775a6defd18661db3`: SUP-01 a SUP-11, fronteira com tenants comerciais, sem autoabertura de tickets, notas nunca outbound; status explícito não homologado.
- `modules/support/README.md` `9659d914b150803e512b57332f42bd5b3f85e600`: desenvolvimento, exige revisão e provisionamento manual.
- `modules/support/package.json` `780d9a0c28e8f0d49e30b7904e80dba0d26eabc4`: pacote TS, build/check/test declarados; **não prova execução**.
- `modules/support/src/index.ts` `9c271e64050d46a83553d12d906360ee6a044617`: exports de domain, service, controller, plugin e SupportHttpModule. Os conteúdos desses componentes não foram examinados nesta rodada.
- `modules/support/src/plugin.ts` `114be278b4fae6fcc9069326a8baace2f63189d0`: defineSyndesModule, apiModule SupportHttpModule, recursos `support:cases:internal` e `support:cases:external` com read/write; registra migration `001_support_cases`. Registro de permission **não comprova grants efetivos**.
- `modules/support/sql/001_support_cases.sql` `237b460d5df25a3e23dd21c97d654f5dfae4c8d9`: tabelas support_queues, support_queue_memberships, support_queue_membership_audit, support_cases, support_case_events; FK de CRM/Inbox por tenant; constraints de tipo/canal, índice único de conversa ativa, gatilhos de auditoria e bloqueio de alterações em histórico. Existência de DDL **não comprova migration aplicada nem isolamento operacional**.
- `tests/platform/support-migration-gate.test.sh` `c2f4b4c834c2c47c47e6e09bad9e34c2ab7a45c4`: casos negativos para ID ausente/inválido/divergente e checagens textuais da integração no installer. **Teste não executado e CI por SHA não consultada**.
- `docs/engineering/TEST-STRATEGY.md` `fd96ea8cc53f064b60deef5c6dd4921521c1726c`: estratégia e invariantes, não resultado.

## Comparação de contratos / fronteiras
- G05 é governança e operação; P06 é owner do produto Support, A03 do frontend, A04 do Host, C03/C04 de identidade/autorização, I04 de banco, Q* de testes. Não transferir ownership de implementação para G05.
- Público: recursos declarados pelo plugin e rotas esperadas no PRD. **Endpoints reais, métodos, códigos HTTP, validação JWT, membership e controle de escopo não inspecionados**; não afirmar equivalência.
- Privado: schema, migration e regras de provisionamento identificados. **Serviço, repositório, adapters, eventos emitidos/consumidos e integração runtime não inspecionados**.
- Divergência documental a revisar: `modules/support/README.md` chama o estado de “branch é desenvolvimento” embora o arquivo esteja em main; ajustar apenas após revisão independente, sem converter para “homologado”.
- Limite de segurança: gatilho SQL de histórico bloqueia DML comum, não é prova contra proprietário de schema/superuser nem prova de política de retenção.
- Gate SQL do Support exige tenant operacional; o teste lido verifica helper e integração por grep, não demonstra comportamento de instalação real.

## Não realizado e gates abertos
Nenhum teste executado, CI de produto consultada, deploy, DevServer, migração, SQL, secrets, credenciais, alteração de runtime, workflows, branches de outros agentes ou merge. Não há comprovação de instalação, homologação ou Pages SHA. Revisar `controller.ts`, `service.ts`, `domain.ts`, `nest.module.ts`, testes unitários/PG/E2E, migrations de dependências e checks por SHA; então reconciliar documentação temática em PR revisada. Este checkpoint não altera status canônico. Auditoria das 57 unidades e owners adicionais permanece aberta; divergências significativas não são zero.
