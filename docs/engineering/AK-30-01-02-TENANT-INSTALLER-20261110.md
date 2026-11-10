# AK-30.01/02 — Tenant installer e ledger SQL

**Estado:** implementação candidata, NÃO registrada nem implantada no ambiente operacional. Depende das PRs #66 (Kernel), #69 (catálogo), #70 (entitlements/intent). Não substitui o Product Gate de Organizations da PR #68, SQL 002, ou o gate de módulos efetivos no Host.

## Contratos e fonte de verdade

- Control DB (syndes_control): catálogo de releases globalmente aprovadas, entitlement por tenant e intenção de instalação, provenientes das AK-10.02/03. O Control DB mantém o estado administrativo com revisão/auditoria, mas **NÃO é o ledger de execução SQL**.
- Cada banco de tenant: schema protegido **_syndes**, tabela **_syndes.module_migrations**, chave (module_id,migration_id), versão, checksum SHA-256, digest SHA-256 da imagem candidata e timestamp aplicado. Cada módulo possui seu próprio schema de domínio. O ledger é autoritativo para o que foi aplicado naquele banco.
- Pacote confiável presente no build do operador: manifest de moduleId, schema, versão, dependências, digest da imagem, lista ordenada de migrations (SQL interno, checksum, versão, objetos pós-condição). Nada é carregado de URL ou texto de request. Rejeitar IDs, versões, módulos duplicados, dependências ausentes, ciclos, hashes errados, schemas reservados e migrations incompatíveis.
- O digest da imagem é um dado **declarado pelo build confiável**; o instalador não consegue provar a origem da imagem ou obter uma assinatura criptográfica do container. A integração com artifact provenance (frente CI delegada) continua pendente.
- **Control Panel não se conecta a PostgreSQL diretamente**. Será somente um cliente de uma API administrativa autorizada, com pré-visualização de plano, pedido de instalação e consulta de status, nunca executor de DDL. Não há frontend, endpoint ou botão novo nesta PR.

## Caminho de execução da primeira instalação

1. Serviço administrativo autenticado valida o principal, conta, capacidades e pedido. O Control DB deve conter release aprovada, entitlement atual, dependências e instalação no estado REQUESTED. Esta PR não implementa a API/identidade do operador.
2. Um **serviço instalador separado**, com credenciais de DDL distintas da role de runtime, recebe apenas tenantId/moduleId e os manifests aprovados no build. O nome do database vem EXCLUSIVAMENTE do registro canônico; a conexão real deve confirmar current_database(). Nenhum request escolhe DNS, DSN, schema ou migration SQL.
3. PLAN é uma inspeção read-only do ledger, hashes, versões e dependencies, e exige que o bootstrap protegido do ledger esteja previamente instalado por operador autorizado. Nenhuma criação automática de schema em PLAN.
4. APPLY abre transação no banco correto, usa lock advisory por módulo, desvia de search_path público, consulta novamente entitlements antes de DDL/commit, executa migrations somente quando ausentes, confere os objetos declarados e insere os registros do ledger na mesma transação. Em erro de SQL: ROLLBACK.
5. VERIFY reconcilia todas as migrations/versões/checksums/digests com as definições aprovadas, schema de domínio e objetos declarados. Também exige que os módulos dependentes tenham instalado o mesmo build esperado, com ledger e objetos físicos presentes naquele mesmo tenant DB.
6. Só após VERIFY uma identidade **syndes_module_installer** (NOLOGIN, não atribuída ao Host/runtime) pode executar a função de atestação no Control DB. Ela é idempotente, valida entitlement, dependências, versão e REQUESTED, grava digest no registro administrativo e evento imutável, e marca INSTALLED. A função confia na identidade autorizada do instalador; o Control DB sozinho não verifica um banco tenant remoto.
7. Se a transação de tenant comitar e a atestação do Control falhar, o registro de Control continua REQUESTED. Uma segunda execução lê o ledger completo sem duplicar SQL e tenta atestar novamente. Não há ilusão de transação atômica distribuída entre databases.

**INSTALLED não é ENABLED**. Nesta fatia, instalação concluída não liga API, workers nem UI de clientes. Apenas a AK-10.04 com autenticação, FGA, memberships, verificações de instalação e estado ENABLED poderá autorizar runtime.

## Segurança e lacunas deliberadas

- Os arquivos infra/postgres/bootstrap/tenant-module-ledger.schema e control-module-attestation.schema são **candidatos inativos**, não registrados em 00-init.sh, no instalador legado, no Docker Compose, na pipeline ou no Core Host em execução.
- O componente apps/core-host/src/module-installer.ts está no mesmo repositório por conveniência, **mas NÃO é provider Nest nem importado em main.ts**. No deploy deverá viver em um processo de operador distinto, com role OpenBao própria e permissão mínima por tenant DB. Core Host deve permanecer read-only sobre metadados de instalação e sem DDL.
- O tenant runtime não tem USAGE no schema _syndes nem DML/SELECT no ledger. O role separado de installer precisa de bootstrap e ACLs específicos por schema; **não demonstramos ainda um role de instalador com menor privilégio em ambiente real**. O teste usa superuser apenas em container descartável.
- Função de atestação CONTROL aceita recibo de um **operador autenticado**, não consulta o tenant DB. A futura aprovação de deploy precisa comprovar identidade segura e que somente o serviço de instalador pode usá-la. Comprometimento da role de instalador é incidente privilegiado.
- Apenas SQL transacional previamente revisado cabe neste mecanismo. Migrations não transacionais, downgrade, versões futuras já instaladas, recuperação após alterações manuais e upgrade entre releases ainda precisam de contratos/migrações adicionais. Não existe DROP CASCADE, desinstalação física ou rollback destrutivo.
- VERIFY checa integridade do ledger e existência das relações explicitamente declaradas, **não prova estrutura completa de colunas/constraints nem ausência de drift em dados**. Uma migração avançada precisará de verificações de integridade/pós-condições específicas.
- A rechecagem de entitlement antes de commit é proteção best-effort, não uma transação distribuída. Mudanças de autorização concorrentes devem ser reconciliadas e nenhuma API pode funcionar somente porque o ledger existe.
- AK-30.03/04/05 e G3 permanecem PEND: ACL de installer por módulo, retomar/upgrade, matriz multi-tenant completa, restauração de backup e suspensão de APIs/workers. Não realizar rollout com esses gates abertos.

## Evidências descartáveis

- PostgreSQL 17 em container tmpfs, Control DB + tenant DB A e B, todos aleatórios/canônicos e apagados ao final da suíte.
- Control com CRM/Inbox/WhatsApp simulado em release manifests de teste; A CRM+Inbox, B CRM apenas. Módulo ausente não ganha schema opcional.
- Testes do PLAN sem DDL, erros de role runtime no ledger, DB de tenant incorreto, ausência de dependência, checksum/imagem não correspondente, falha de SQL após DDL com rollback atômico, replay, receipt de Control e verificação pós-instalação.
- Fixtures de teste são intencionalmente simples; **não foi executado Organizations schema-v2 da PR #68** ou qualquer migration de domínio real neste gate.

## Contrato futuro do Platform Manager

O frontend separado do Manager consulta APIs do Control Plane, sem acesso ao banco tenant:
- Área **Clientes > Detalhes > Módulos** somente após aprovação do Product/UI Gate. Mostrar Disponível/Aprovado, Contratado, Versão solicitada, Instalação pendente/instalada/erro, Habilitado/Suspenso, dependências e histórico; ações com confirmação, motivo e RBAC explícito.
- Manager global administra catálogo e habilitações, **não lê por isso conversas, pessoas, segredos ou mensagens do tenant**. O tenant interno Syndes continuará operando em Workspace isolado, com suas próprias identidades.
- Um status exibido como INSTALLED só pode vir de uma atestação com VERIFY; um status ENABLED exige gate do Host. Estado de UI nunca vira fonte de verdade ou chave de autorização.
- Definir endpoints, políticas e Product Gate da UI em AK-20 / AK-10.04, depois que os contratos operacionais estiverem estabilizados. Não criar menus/telas fictícios antecipadamente.

**Próximo trabalho técnico:** AK-10.04 (port real em endpoints/jobs) condicionado a ACK do installer e integração em main, seguido de AK-30.03/04/05 e homologação operacional autorizada.
