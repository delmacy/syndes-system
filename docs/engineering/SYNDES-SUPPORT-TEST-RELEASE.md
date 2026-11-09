# Syndes Support — Plano de testes, homologação, operação e rollback
Status: proposta de engenharia para #32; sem aprovação de implantação.

## Baseline e fases
Registrar branch/commit, versões Node/npm/Go/Postgres, comando exato, sucesso/falha/skip. Executar previamente e após os commits: packages/core-kernel, modules/core-crm, modules/inbox, modules/whatsapp, modules/organizations, apps/core-host e frontend quando alterado. Testes unitários Node (node:test), integration real com database efêmero, E2E Playwright do frontend conforme interface implementada.

## Security cases obrigatórios
- Tenant cliente B ou UUID forjado nega antes de resolver pool, ainda que tenha FGA para suporte.
- Ausência de configuração Syndes, JWT ausente, token de cliente/issuer errado, FGA down -> deny.
- Solicitante interno só vê próprios; não enumera interno de outro; membro de TI não vê Produto ou fila externa; Master Admin sem membership não pode ler ticket.
- Agente externo não cria ticket com conversa de cliente, outra conta WhatsApp, outra organização/workspace, sem contato CRM válido ou referência alterada.
- Tipo interno nunca entra em fila externa; nota interna jamais vira mensagem outbound; mutação e auditoria juntas.
- Tentativa de concorrência/replay não cria tickets duplicados vinculados à mesma conversa sem contrato explícito.
- Documentar que nenhum SSE Support foi adicionado; manter testes SSE da Inbox.

## Dados e retenção
Fixtures com UUIDs sintéticos, sem números reais, tokens e mensagens reais. Operação externa em tenant Syndes dedicado. Anexos/retention novos bloqueados até política aprovada. Nunca registrar payloads privados no stdout/CI.

## Product Gate e release
1. Revisão independente do PR; CI verde inclusive migrations em PG descartável.
2. Provisão/verificação explícita de tenant Syndes e telefone Whatsmeow dedicado.
3. Audit de memberships dos operadores e recursos FGA `support:cases:internal`, `support:cases:external`; garantia de ausência de acesso implícito de Master Admin.
4. Backup criptografado de dados reais (sem exposição no CI), ensaio de restore, versão de imagem imutável e janela aprovados.
5. Migration aditiva somente no tenant Sindes, smoke autenticado, casos negativos por filas/tenant; sem alterar SQL 002 nem ativar multi-org.
6. Aprovação formal de publicação e observabilidade mínima sem logs sensíveis; PR merged é condição necessária, não suficiente.

## Rollback
Reverter imagem/manifests e rotas do módulo pelo fluxo de release aprovado; manter tabelas e auditoria intactas (sem DROP/TRUNCATE), registrar horário e motivo. Se falha de dados, somente restore a partir de backup verificado mediante autorização explícita e impacto conhecido. Não desinstalar o módulo de tenants de clientes: ele nunca deveria ter sido instalado para eles.

## Evidências
Comandos, URLs de checks, commit e hashes de migrations ficam no relatório do PR; nenhuma afirmação de deploy sem teste real de instalação e smoke em ambiente autorizado.
