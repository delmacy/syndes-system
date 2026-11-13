---
title: "I05 · Dependências e integrações"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dependências e integrações

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/STATUS.md)

> L10: \| Identidade e segredos \| `infra/security-access/compose.yaml`: Keycloak 26.8.1, OpenFGA 1.22.1, OpenBao 2.7.0; rede `syndes-secrets` com `internal: true` \| `internal` declarativo não demonstra conectividade ou seal/ACL reais \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/REFERENCIA-TECNICA.md)

> L10: \| `infra/security-access/compose.yaml` \| `keycloak:26.8.1`, `openfga:v1.22.1`, `openbao:2.7.0`, `openfga-migrate` \| `syndes-secrets` bridge interna, `syndes-security-access`, `syndes-data`, `syndes-master-identity`; Raft `openbao_raft` \|

> L15: **Atenção:** `openfga-migrate` é job mutável declarado, não executado na auditoria. `env_file`, secrets e caminhos de runtime são referenciados, **não lidos**. Nenhum `docker inspect` de containers, env, mounts ou IPs foi realizado.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/OPERACAO.md)

> L15: Não existe evidência de isolamento efetivo, rede de produção ou inventário completo de todos os stacks. O job `openfga-migrate` não foi executado. Nenhuma configuração, secret, container, volume, porta ou firewall foi modificado.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/chapters/04-contratos-e-dependencias-publicas.md)

> L3: O contrato do I05 é **declarativo**, não export TypeScript: Compose services, nomes de redes externas, volumes, mounts, `depends_on`, secrets e restrições de execução. Consumidores são workloads de I04, C03, C04, C05 e Manager. `openfga-migrate` é job de migração declarado; não executar como teste de documentação. Não há endpoint HTTP, evento de negócio, contrato de frontend ou migration SQL atribuível ao I05. Evidên

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I05-docker-e-redes/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
