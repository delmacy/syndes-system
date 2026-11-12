# ADR — Composição modular do Core por perfis de implantação

**Data:** 2026-11-11 · **Estado:** decisão arquitetural aprovada para evolução incremental; perfis de deployment ainda NÃO implementados. **Issue:** [#104](https://github.com/delmacy/syndes-system/issues/104).

## Objetivo

Um mesmo código-base pode gerar diferentes instâncias de Core Host, cada uma com um conjunto autorizado de módulos de produto. Ex.: instância A: `platform + organizations + crm + inbox + service`; instância B: `platform + organizations + crm + inbox + whatsapp + support`. Os perfis são exemplos futuros, não imagens validadas. A mesma implementação pode atender aplicações SaaS compartilhadas ou soluções dedicadas, sem forks por cliente.

### Decisão de responsabilidades

- **`packages/core-kernel`:** ports, contratos versionados, definições de módulo, registro/ordenação de dependências, capacidades de autorização e orquestração sem dependências de PostgreSQL, NestJS, OpenFGA, Keycloak ou OpenBao.
- **`apps/core-host`:** composition root NestJS, seleção de plugins trusted, ligação entre ports e adapters concretos, ciclo de vida e rotas. O Host NÃO contém regras de negócio específicas dos módulos.
- **`modules/*`:** lógica de domínio, persistência e APIs próprias. Comunicação síncrona entre módulos via contratos explícitos injetados pelo Host; integração assíncrona via eventos versionados e outbox. Imports diretos de implementações de outros módulos não são uma extensão pública do Kernel.
- **`infra/`:** provisionamento, isolamento de dados, secrets, roteamento, operações, perfis e releases. O controle de entitlement por tenant é independente da composição física da imagem.

### Estado atual verificado em `main 1291465`

Existem: `TenancyPort`, `AuthorizationPort`, `TrustedTenantDatabaseProvider`, `TrustedTenantTransactionProvider`, `ModuleRegistry`, `SyndesPlugin`, `module-host.ts`, loader de `apps/core-host/config/modules.json` e composição Nest. O registry rejeita dependências ausentes e ciclos. `Dockerfile` constrói todos os módulos implementados; existe um único arquivo fixo de módulos no Host. O plugin Service está no pacote, mas não foi habilitado no Host operacional.

**Lacunas:** manifestos de perfil versionados, seleção por instância, geração de imagens com somente dependências selecionadas, validação pré-deploy independente, roteamento por instância, evidências de isolamento/permissões e ownership exclusivo de workers. Dependência cross-container não existe como contrato remoto geral, nem deve ser presumida como disponível.

### Dependências reais hoje

| Módulo | Depende localmente de |
|---|---|
| CRM | platform |
| Organizations | platform |
| Inbox | platform, CRM |
| WhatsApp | platform, CRM, Inbox |
| Service | platform, Organizations, CRM, Inbox |
| Support | platform, Organizations, CRM, Inbox, WhatsApp |

Usar IDs canônicos (`crm`, `inbox`, `whatsapp`, `organizations`, `service`, `support`); números em diagramas são apenas exemplos.

## Regras de composição

1. **Primeiro modo:** dependências locais atendidas dentro de cada Core Host; composição e validação determinísticas antes de inicializar NestJS.
2. Profiles são artefatos confiáveis, imutáveis e versionados **no build/deploy**, não scripts de terceiros carregados durante solicitações HTTP. Não criar marketplace.
3. Para autorizar uma operação: módulo **presente no perfil da instância E instalado/ENABLED no tenant E ator autorizado** com tenant/org/workspace e OpenFGA; falhar fechado em qualquer ausência.
4. Se dois Hosts operarem no mesmo tenant, o ownership de mensagens, eventos, workers e agendamentos deverá ser explícito; nunca assumir que idempotência isolada resolve concorrência entre escritores.
5. Perfis dedicados não criam novo Control DB ou banco PostgreSQL por módulo. O isolamento de tenants permanece por database canônico, com segredos e permissões estritos.
6. Comunicação cross-process requer contratos de transporte, timeouts, retries, autorização, descoberta e testes próprios. Implementá-la somente após um caso de uso real, não como requisito para o primeiro manifesto.
7. Não criar frontend por módulo: Workspace, Manager e Support permanecem aplicações próprias com `front-shared` visual.

## Roteiro e gates

**CMP-01** Inventariar ports, providers e dependências; testes de contrato e negativos de arquitetura.  
**CMP-02** Definir schema de `composition-profile` e validador offline (IDs confiáveis, versões, dependências, ciclos, conflito de rotas, checksums).  
**CMP-03** Compor 2 perfis locais no mesmo source sem editar `main.ts`, com injeção de módulos e startup fail-closed.  
**CMP-04** Produzir artefatos/imagens reprodutíveis por perfil e atestar SBOM/digest.  
**CMP-05** Relacionar profile da instância, catálogo instalado/ENABLED por tenant e guards HTTP/workers.  
**CMP-06** Validar isolamento de deploy, ingress, secrets e hosts; canary/rollback.  
**CMP-07** Avaliar e implementar ports remotos apenas quando necessário, nunca por hipótese.  
**CMP-08** Ownership de workers/dispatchers e prevenção de efeitos duplicados entre instâncias.  
**CMP-09** Teste com 2 perfis e 2 tenants em staging autorizado, incluindo falhas, permissões e rollback.  
**CMP-10** Opcional e posterior: UI de administração de perfis, somente com Product Gate próprio.

**Prioridade no MVP:** CMP-01/CMP-02 e limites de contrato do CMP-03 podem avançar paralelamente à integração. Não bloquear WhatsApp → Inbox → CRM → Service por exigência de imagens dedicadas. CMP-04 a CMP-10 são marcos graduais, dependentes da primeira jornada operacional e dos controles de deploy. Backup/restore completo permanece no gate final do MVP, com salvaguardas preventivas.

## Critério de pronto

Não chamar a funcionalidade de operacional até duas imagens/instâncias reais carregarem apenas seus módulos autorizados, com dependências consistentes, builds reproduzíveis, isolamento de tenants, gating de módulos, ownership de jobs e testes de recuperação e segurança. A issue #104 é a fonte de acompanhamento; este ADR define os limites de arquitetura.
