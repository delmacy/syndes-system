# I11 — 07 | Riscos, lacunas e próximos passos

> Auditoria documental estática em 2026-11-14. Fonte: `infra/master-admin/homolog-deploy.sh`, blob `39f85b3ec07b92a90f3e83408c3ad2541ec6fcf3` no `main` `fa2ddb8dc162b7b3ed00f3ba0576e360f54ba731`. A leitura do script não constitui execução, teste aprovado nem homologação.

## Riscos e bloqueios rastreáveis

| ID | Declaração observada no código | Lacuna de evidência | Critério para encerrar |
|---|---|---|---|
| I11-R01 | Restrição de diretório de checkout e opções `--preflight`/`--apply` | Nenhum log de preflight validado nesta revisão | Execução autorizada, resultado, SHA e ambiente registrados |
| I11-R02 | Inspeção de PostgreSQL, Keycloak, redes internas e OpenBao | Saúde real dos serviços não verificada | Witness independente e datado dos checks |
| I11-R03 | Verificações de segredo em tmpfs e permissões 0700/0600 | Configuração operacional não inspecionada | Evidência sanitizada sem divulgar segredo |
| I11-R04 | Manifesto `CI_ARTIFACT_MANIFEST.json`, SHA de origem e comparação do frontend | Não se comprovou pipeline verde nem proveniência de artefato implantado | Identificar execução CI, commit e artefato correspondente |
| I11-R05 | Identidade Tailnet, issuer OIDC e porta 9447 | Rota HTTPS e certificado não testados | Probe autorizado, certificado e identidade documentados |
| I11-R06 | Caminho `--apply` e mecanismo de rollback restrito ao Manager | Não se demonstrou recuperação completa de banco/estado externo | Ensaio de rollback isolado com escopo e limites explícitos |

## Estado de comprovação

- **Fonte existente:** confirmado por leitura GitHub do script no SHA acima.
- **Testes bem-sucedidos:** não demonstrados nesta auditoria.
- **Deploy/homologação:** não demonstrados nesta auditoria.
- **Witness registry:** nenhuma entrada nova; não criar prova retroativa a partir da presença do código.

## Próximos passos documentais

1. Conciliar as revisões concorrentes de STATUS, REFERENCIA-TECNICA e OPERACAO antes de integração.
2. Completar e verificar individualmente os oito capítulos temáticos e o blueprint/WBS.
3. Executar gates MkDocs estrito, links e registry em ambiente isolado; anexar saídas e SHA.
4. Comparar novamente `main` e branch imediatamente antes de revisão/merge; não integrar documentos sem testes.

[Status](../STATUS.md) · [Referência técnica](../REFERENCIA-TECNICA.md) · [Operação](../OPERACAO.md)
