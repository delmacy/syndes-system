# ADR proposta — Agregados do Support no Syndes Platform Manager

Estado: **contrato de evolução, ainda não implementado nem autorizado**. Dependências: PR #33 (Platform Manager), PR #34 (Support), Issue #32 e Product Gate. Não incluir UI especulativa em nenhuma das PRs atuais.

## Problema

A Issue #32 prevê indicadores de chamados internos/externos no Platform Manager. A API Manager opera por projeto com role de leitura **apenas no Control DB**, sem acesso ao banco do tenant operacional Syndes nem à rede do Core Host. Acessar Support usando o JWT do Manager ou abrir CONNECT ao banco Support quebraria a decisão arquitetural da PR #33.

## Fronteira escolhida para projeto futuro

Definir integração posterior **somente de agregados sanitizados**. Um produtor autorizado de domínio Support calcula contagens de casos por audience e estado, e um transporte explicitamente autorizado entrega um snapshot reduzido a armazenamento de metadados gerenciado, com controle de proveniência, idempotência, versão, TTL e auditoria. A API do Manager lê **somente** esse snapshot via role do Control DB com SELECT no conjunto mínimo de dados; não faz join, consulta, proxy, RPC direto para Core Host, nem recebe acesso a bancos de tenant. A escolha exata do transporte e a autorização da role de escrita devem ser revisadas em PR/ADR próprios antes de qualquer implementação.

**Atributos permitidos:** instante de cálculo, versão, estado de frescor/erro, contagens agregadas `new`, `triage`, `in_progress`, `waiting_customer`, `resolved` e `closed` separadas entre `internal` e `external`. Identificador operacional do produtor não deve expor tenant comercial; nenhum filtro por cliente individual. **Atributos proibidos:** IDs de tickets, solicitantes, contatos, conversas, telefones, nomes, usuários, notas, corpo, anexos, IDs de tenants comerciais ou transcrições. Não chamar chamados de “vencidos” sem SLA pactuado, cronologia e teste de cálculo. Dados desatualizados precisam de estado explícito; jamais exibir zeros fictícios.

## Segregação de identidade

- `syndes-master-admin`: token restrito à API do Platform Manager/Control Plane; não pode chamar Core Host ou Support (o Support exige `azp=syndes-support-ui`).
- `syndes-support-ui`: token destinado a solicitações reais do Support; não autoriza acesso ao Manager.
- Produtor de agregados: identidade de **serviço** nova, delegação mínima e auditada, separada dos tokens de usuário e sem permissão de leitura de transcrições no destino. Não implementar com refresh token de usuário.
- O browser Manager nunca recebe credencial/identificador para consultar diretamente Support.

## Critérios de aceite da próxima entrega

Novo PRD/WBS e revisão independente de Control + Tenant planes; migrations mínimas e ACLs testadas em PostgreSQL descartável; replay/idempotência e envelhecimento de snapshot, casos sem dados, token cruzado 401/403, avaria do transporte mostra “indisponível” e não valores inventados, ausência de PII verificada em payload, zero permissões de escrita para a API Manager, E2E e CI sem regressões. Só então adicionar cards existentes/planejados ao frontend, sem novas abas nem mistura de origens.

**Decisão de governança:** a WBS 8.5 do Support permanece bloqueada para implementação, mas seu contrato de segurança está proposto aqui. Nenhum merge ou deploy é autorizado por esta ADR.
