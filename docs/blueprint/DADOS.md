# Dados e persistência

> **Inventário por owner.** Arquivos SQL, entidades, tabelas e relacionamentos são consultados por módulo. A presença de uma migration no repositório não prova aplicação ou disponibilidade no banco de um ambiente específico.

## Consultar schemas e tabelas {#consultar-schemas}

[Explorar dados por módulo](CATALOGO-MODULOS.md?camada=dados) · [Plataforma PostgreSQL](../subprojects/I04-postgresql/README.md) · [Referência de CRM](../subprojects/P01-crm/REFERENCIA-TECNICA.md)

O catálogo lista as tabelas identificadas em arquivos SQL próprios do módulo. Para completar a análise é necessário conferir migrations aplicadas, ownership do schema, chaves, constraints, índices, cardinalidades, regras de acesso e destino **Tenant DB** versus **Control/Manager DB**.

## Como ler o modelo de dados {#modelo-de-dados}

1. **Domínio:** entidades de negócio e agregados descritos na especificação do proprietário.
2. **Persistência:** definições SQL e schema do owner, com migração e versão verificáveis.
3. **Contratos:** estrutura de entrada/saída da API e eventos; nunca inferir contrato público de tabela interna.
4. **Rastreabilidade:** referências de código, ADR/WBS e evidências de teste em cada módulo.

[Fontes de verdade e critérios de evidência](../standards/FONTES-DE-VERDADE-E-RASTREABILIDADE.md). Os mapas de entidades e matrizes só são apresentados como aprovados quando houver fonte auditada.
