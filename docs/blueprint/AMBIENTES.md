# Deploy, hospedagem e ambientes

> **Entrada operacional da infraestrutura Syndes.** Este índice separa ambientes e processos de deploy dos módulos técnicos; os hosts e componentes continuam documentados sob seu proprietário canônico.

## Ambientes {#ambientes}

[Hospedagem e ambientes — I02](../subprojects/I02-server02/README.md) reúne a composição de desenvolvimento, produção, servidores, redes e serviços de apoio conforme as fontes verificadas. Os detalhes de cada host são componentes documentais da hospedagem, não produtos independentes.

## Deploy e recuperação {#deploy-recuperacao}

- [Release e rollback — I11](../subprojects/I11-release-e-rollback/README.md).
- [Backup e restore — I10](../subprojects/I10-backup-e-restore/README.md).
- [Monitoramento dos pipelines](../monitoramento/README.md).
- [PostgreSQL — I04](../subprojects/I04-postgresql/README.md).
- [Segurança e contratos de acesso](../standards/CONTRATOS-PUBLICOS.md).

## Evidências e segurança {#evidencias}

Execução de workflow, healthcheck e commit não equivalem automaticamente a release aceita. Confira os gates, incidentes e provas na documentação de cada unidade. Este site é público: **não** publique IPs administrativos privados, senhas, tokens, DSN, secrets ou topologia interna sensível.
