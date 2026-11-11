# WBS — WA-DATA-01 e CRM-WA-01

Fonte: docs/engineering/WA-DATA-01-CRM-WA-01-20261111.md.
Esta WBS não autoriza migração, emissão de mensagens ou alteração de registros reais.

| ID | Prioridade | Entrega | Critério verificável | Estado |
| --- | --- | --- | --- | --- |
| WA-DATA-01.01 | P0 | Classificação antes da fila para live/history | Go conta texto encaminhado, mídia não suportada e metadados inválidos por conta sem PII | CODIFICADO + GO TEST PASS; DEPLOY PENDENTE |
| WA-DATA-01.02 | P0 | Endpoint de cobertura técnico autenticado | Apenas token interno do tenant + account habilitada; não expõe corpo/JID/telefone; indicadores reiniciam com processo | CODIFICADO; CI/DEPLOY PEND |
| WA-DATA-01.03 | P0 | Relatório persistido de qualidade do tenant | SQL BEGIN READ ONLY, agregados por tipo/estado, nenhum dado pessoal; comparável aos contadores Go após deploy | EXECUTADO NO TENANT ATIVO, SEM ESCRITAS |
| WA-DATA-01.04 | P1 | Ledger durável de eventos antes da fila | Contadores sobrevivem restart e permitem reconciliação; instrumentar perdas antes do enqueue sem flood de logs | PENDENTE |
| WA-DATA-01.05 | P1 | Contratos de mídia completa | Conteúdo imagem/áudio/vídeo/documento/sticker com armazenamento e ACL tenant-safe, sem bot responder por mídia sem compreensão | FORA DESTA FATIA: WA-MEDIA-01 |
| CRM-WA-01.01 | P0 | Resolvedor read-only exato | Correspondência por JID/PN verificado ou telefone exato dentro da mesma Organization; sem match por nome/LID inventado; ambiguidade explícita | CODIFICADO + TESTES PASS |
| CRM-WA-01.02 | P0 | Simular reconciliação tenant real | Contagem de link_existing, provisional e review em transação somente leitura; sem PII ou mutações | EXECUTADO: 14 PROPOSTAS, 0 LINKS |
| CRM-WA-01.03 | P0 | Operação transacional idempotente de vincular/criar provisório | Revalidar source e ownership, serializar concorrência, impedir duplicados, auditar e permitir rollback; aprovação de operador | PENDENTE, NÃO APLICAR EM PRODUÇÃO |
| CRM-WA-01.04 | P1 | Revisão de ambiguidades pela UI autorizada | Backoffice do CRM com grants, sem duplicar frontend e sem criar menus fictícios | PENDENTE |
| CRM-WA-01.05 | P1 | Homologação Keycloak/OpenFGA/tenant A-B e job integrado | Provas de isolamento e performance; module gates ativos somente após Control DB provisionado/restore testado | BLOQUEADO |

## Condições de saída

- WA-DATA-01 não estará concluído integralmente até cobrir eventos perdidos antes da fila mesmo após restart.
- CRM-WA-01 não estará concluído integralmente até existir operação transacional segura e homologação do vínculo Inbox/CRM em dados reais. A mera proposta de 14 contatos não é cadastro.
- Não reutilizar token do Manager, não criar frontend por módulo, não remover SQL 002 e não executar migrações operacionais por conta desta WBS.
