# [ID] — Contratos públicos do subprojeto
> Rascunho de documentação **referencial**, não é manifesto executável e não substitui ModuleDefinition/plugin/exports existentes.

## Identidade
- Unidade no catálogo: [ID, nome, categoria]
- Código proprietário: [path canônico]
- Fonte executável / pacote: [package.json#exports, contrato TS/OpenAPI/AsyncAPI/schema/infra]
- Revisão verificada: [main SHA, data]
- API/manifesto de runtime: [ModuleDefinition, syndesPlugin ou N/A]

## O que outros módulos podem conhecer e utilizar
| ID | Tipo | Contrato público | Versão | Path canônico | Consumidores conhecidos | Garantia |
|---|---|---|---|---|---|---|
| [CTR] | API/evento/port/pacote/serviço | [nome] | [v] | [path] | [IDs] | [erros, isolamento] |

## Capabilities e pré-requisitos
| ID | Capacidade fornecida | Dependências HARD | Dependências SOFT | Comportamento quando ausente |
|---|---|---|---|---|
| [CAP] | [efeito verificável] | [ID/CAP] | [ID/CAP] | [deny/degradação] |

**Estado atual de disponibilidade, evidências e permissões do tenant:** ver STATUS e runtime; este catálogo não implica habilitação.

## Bibliotecas e imports permitidos
| Pacote | Import público existente | Uso | Limites |
|---|---|---|---|
| [pkg] | [nome exportado pelo package.json] | [responsabilidade] | [não acessar internals] |

## Variáveis de ambiente / configuração declarativa
| Nome real verificado no código | Origem (env/secret/config) | Obrigatória em | Efeito se ausente | Dono |
|---|---|---|---|---|
| [ENV] | [OpenBao/host/etc.] | [ambiente] | [fail closed] | [ID] |

Não gravar valor, senha, token, DSN de tenant, exemplos de segredo ou caminhos secretos reais. Confirmar nomes no código; não criar variáveis hipotéticas.

## APIs/eventos/ports, dados e compatibilidade
- Regras de autenticação/autorização: [referência].
- Propriedade de dados: [entidades e owners, sem expor SQL privado].
- Erros, retries, idempotência e fallbacks: [referência].
- Mudanças incompatíveis: mapear consumidores, expand→migrate→contract, testes de contrato e aprovação.
- Diagramas públicos: [IDs e path].
