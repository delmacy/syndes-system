# Core Host — servidor de homologação

> **Atualização 2026-11-01:** a seção abaixo é o roteiro/histórico de rollout do Core Host preparado antes de existir acesso remoto funcional. O Core Host, CRM, Inbox e Workspace **foram instalados e testados no DevServer01 como laboratório**, conforme [Runbook do Workspace](WORKSPACE-DEVSERVER01-RUNBOOK.md) e [Handoff](../product/WORKSPACE-MVP-HANDOFF.md). Não interpretar a observação de equipamentos offline no final deste arquivo como estado atual. **Nenhuma implantação em produção ocorreu.**

## Evidência de inicialização

O workflow identity-integration executa a imagem Docker de produção e seu processo dist/main.js em ambiente descartável, com PostgreSQL, Keycloak, OpenFGA e OpenBao reais. O teste cobre montagem de CRM/Inbox, TLS/AppRole, conexão ao banco de controle, /readyz, endpoints públicos, negação sem token e ausência de publicação de portas.

**Limite:** não equivale a um login interativo com usuário real e permissões OpenFGA em um tenant provisionado. Isso exige uma etapa própria de aceitação. Nunca reutilizar senhas, tokens, certificados ou init/unseal de infra/.env.ci em servidores permanentes.

## Checkpoint antes da implantação

1. Confirmar conectividade e autorização de acesso ao host escolhido; registrar containers/Compose existentes, redes, volumes, espaço em disco, memória, versão atual e digest da imagem para rollback.
2. Inspecionar a stack security-access e confirmar OpenBao inicializado/deslacrado com recuperação segura, AppRoles core-host e core-tenant-db válidos, PostgreSQL de controle, Keycloak issuer/JWKS e store OpenFGA. Não sobrescrever secrets.
3. Selecionar uma imagem imutável do commit aprovado, revisar migrações instaladas e realizar backup antes de qualquer alteração de schema. Não usar env.ci.
4. Fazer atualização **somente** do serviço Core Host já aprovado, sem down -v e sem recriar bancos: docker compose -f apps/core-host/compose.yaml up -d --no-deps --no-build core-host (com o ambiente correto do servidor e imagem previamente selecionada).
5. Pela rede interna confiável, verificar /healthz, /readyz, /modules/inbox/config, /inbox, /crm e 401 sem login. Depois executar caso positivo e negativo com JWT real, tenant correto/incorreto e grants OpenFGA.
6. Na falha, restaurar somente a imagem anterior do Core Host, preservando Raft do OpenBao, PostgreSQL e demais stacks. Logs não devem imprimir segredos.

**Estado:** os três dispositivos de acesso remoto estavam offline durante o preparo; nenhuma instalação no servidor físico pode ser considerada concluída apenas por CI.
