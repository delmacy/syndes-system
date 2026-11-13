## 2. Requisitos, histórias e casos de uso

| ID | Requisito observado/proposto | Evidência / aceite |
|---|---|---|
| C05-RF01 | Workload autentica com AppRole e lê somente seu KV | A04 `loadCoreSecrets` e teste mockado; validação real pendente |
| C05-RF02 | Canal exige TLS/CA e recusa endpoint HTTP | Código A04 e renderer |
| C05-RF03 | Token bootstrap é revogado mesmo após read falho | Código e testes A04; efetividade real pendente |
| C05-RF04 | Infra renderer produz arquivos protegidos sem registrar valores | Fonte Python; execução real pendente |
| C05-RF05 | Policies segregam namespaces por serviço | HCL versionado; ACL aplicada não verificada |
| C05-RF06 | Raft pode ser recuperado com backup e custódia | Runbook/smoke descartável; operação pendente |

A aprovação de requisito depende de contrato owner e teste de negação; nada foi promovido a homologado por documentação.
