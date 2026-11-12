# Mapa técnico por camadas

> **Entrada de arquitetura do Syndes.** Consulte a plataforma por responsabilidade técnica e por módulo. Este mapa organiza a leitura; não cria módulos, contratos nem declarações que não existam no repositório.

<div class="syndes-layer-intro" markdown="1">

**Por onde começar?** Identifique o domínio ou unidade responsável, selecione a camada no [catálogo técnico](CATALOGO-MODULOS.md) e abra a evidência de origem. Para entender se está funcionando, consulte operação, testes, status e histórico — código encontrado não equivale a serviço homologado.

</div>

## Camadas do sistema

<div class="syndes-layer-grid" markdown="1">

<div class="syndes-layer-tile" markdown="1">

### 01 · Domínio e capacidades {#dominio}

Responsabilidade, entidades de negócio, regras, casos de uso e limites de ownership.

[Explorar domínio por módulo](https://delmacy.github.io/syndes-system/blueprint/CATALOGO-MODULOS/?camada=dominio)

</div>

<div class="syndes-layer-tile" markdown="1">

### 02 · Dados e persistência {#dados}

Schemas, tabelas e migrations SQL declaradas; destino Tenant DB ou Control/Manager DB a confirmar no owner e no ambiente.

[Consultar evidências SQL](https://delmacy.github.io/syndes-system/blueprint/CATALOGO-MODULOS/?camada=dados)

</div>

<div class="syndes-layer-tile" markdown="1">

### 03 · Interfaces e aplicações {#interfaces}

Workspace do tenant, Platform Manager, Support e elementos compartilhados, com fronteiras de sessão independentes.

[Consultar interfaces](https://delmacy.github.io/syndes-system/blueprint/CATALOGO-MODULOS/?camada=interfaces)

</div>

<div class="syndes-layer-tile" markdown="1">

### 04 · Contratos públicos e internos {#contratos}

Exports de pacote e ports autorizadas versus classes e métodos internos. Um `export` TypeScript isolado não é contrato público.

[Consultar contratos declarados](https://delmacy.github.io/syndes-system/blueprint/CATALOGO-MODULOS/?camada=contratos)

</div>

<div class="syndes-layer-tile" markdown="1">

### 05 · APIs HTTP {#apis}

Controllers e decorators registrados no código, com verificação posterior de composição no host, autenticação e permissões.

[Consultar APIs identificadas](https://delmacy.github.io/syndes-system/blueprint/CATALOGO-MODULOS/?camada=apis)

</div>

<div class="syndes-layer-tile" markdown="1">

### 06 · Dependências e stack {#dependencias}

Bibliotecas no manifesto e referências técnicas; importações entre módulos devem passar por contratos públicos.

[Consultar dependências declaradas](https://delmacy.github.io/syndes-system/blueprint/CATALOGO-MODULOS/?camada=dependencias)

</div>

<div class="syndes-layer-tile" markdown="1">

### 07 · Operação e hospedagem {#operacao}

Desenvolvimento, produção, composição dos servidores e serviços auxiliares, deploy, backup, segurança e observabilidade.

[Consultar operação por unidade](https://delmacy.github.io/syndes-system/blueprint/CATALOGO-MODULOS/?camada=operacao)

</div>

<div class="syndes-layer-tile" markdown="1">

### 08 · Qualidade e rastreabilidade {#qualidade}

Testes, gates, critérios de aceite, WBS, Issues, commits e evidências de entrega.

[Consultar evidências e testes](https://delmacy.github.io/syndes-system/blueprint/CATALOGO-MODULOS/?camada=qualidade)

</div>

</div>

## Integração entre módulos e Event Bus {#eventos}

Eventos não devem ser inferidos de nomes de classes nem classificados como contratos versionados sem validação do produtor, payload, versão, consumidores, idempotência e transactional outbox. A referência transversal permanece em [C06 — Event Platform](../subprojects/C06-event-platform/README.md) e no [padrão de contratos](../standards/CONTRATOS-PUBLICOS.md). A extração automática por evento é **uma lacuna do inventário atual**.

## Critério para aceitar uma informação como verdade {#evidencias}

| Pergunta | Fonte principal | O que **não** comprova |
|---|---|---|
| Quem é dono do módulo? | [Catálogo canônico](https://github.com/delmacy/syndes-system/blob/main/catalog/work-units.json) | Que está instalado |
| Qual comportamento foi especificado? | Especificação e capabilities do módulo | Que está implementado |
| Quais símbolos, schemas, rotas e dependências existem? | Inventário extraído do commit e links de arquivo/linha | Deploy, importação pública ou migration aplicada |
| O que está habilitado para determinado tenant? | Host, grants e evidências de integração | Apenas a presença de package ou decorator |
| O que foi entregue? | [Projetos e workpackages](PROJETO-E-WORKPACKAGES.md), status, testes e [histórico](LINHA-DO-TEMPO.md) | Conclusão inferida de Issue/commit |

**Princípio operacional:** `DECLARADO ≠ IMPLEMENTADO ≠ INTEGRADO ≠ TESTADO ≠ HABILITADO ≠ ACEITO`. Não publique endpoints administrativos privados, tokens, endereços internos de infraestrutura ou dados de clientes no portal público.
