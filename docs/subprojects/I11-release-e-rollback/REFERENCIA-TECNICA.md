# I11 — Release e Rollback | Referência técnica

> Auditoria estática parcial em 13/11/2026. Fonte GitHub `infra/master-admin/homolog-deploy.sh`, blob `39f85b3ec07b92a90f3e83408c3ad2541ec6fcf3`, main `3a943ea518df2239525d2f518bb1b061671bc358`. Não representa teste, deploy ou homologação.

## Escopo e ownership
O script Bash é um gate de deploy **isolado do Platform Manager** no DevServer01. Não é uma API de release genérica, serviço HTTP, classe TypeScript, frontend nem migration. Ownership formal continua sujeito ao `catalog/work-units.json`; nenhum contrato de outro owner é alterado aqui.

## Interface declarada
- Modos `--preflight` (padrão) e `--apply`; outros argumentos falham.
- Checkout permitido somente em dois caminhos explicitamente codificados para homologação/release do Manager.
- Dependências: Docker, jq, Tailscale, Python 3, curl, Git, PostgreSQL saudável, Keycloak ativo, redes internas, OpenBao acessível.
- Gate de Control verifica role de runtime e owner ativo via consultas de leitura. Isto não é evidência de schema aplicado.
- Segredos: exige tmpfs em `/run`, diretório modo 700, arquivo modo 600 e UID 1000; o script não deve ser usado como fonte de credenciais.
- Proveniência: `CI_ARTIFACT_MANIFEST.json` fornece `git_commit`; verifica SHA, commit presente no histórico, ausência de alterações rastreadas e compatibilidade entre fontes frontend e artefato.
- Identidade e HTTPS: exige hostname `.ts.net`, issuer OIDC correspondente, porta privada 9447 livre, verificação da rota Tailscale Serve sem Funnel.
- `--apply`: gera arquivos runtime locais, constrói imagens sem pull, inicia Compose Manager, aguarda HTTP local e configura Serve privado.
- `rollback_on_error`: trap de saída tenta desligar a rota 9447 somente quando identificada como própria e remover o Compose Manager. Não restaura dados, credenciais, migrations ou serviços externos.

## Limites dos contratos
O script contém SQL de **verificação** e operações Docker/Tailscale, não contratos HTTP públicos do produto. Não inferir frontend, endpoints, tabelas de domínio, eventos ou migrations da presença de comandos de infraestrutura.

## Matriz de evidência
| Dimensão | Observado | Não comprovado |
|---|---|---|
| Fonte | Shell com gates e rollback declarados | Execução bem-sucedida |
| Testes | Condições verificadas por inspeção de código | Testes unitários, integração, CI e preflight executados |
| Ambiente | Caminhos e serviços esperados pelo script | Estado real do DevServer01 |
| Release | Mensagem de conclusão declarada | Deploy, smoke, login real, aceite e rollback homologados |

## Próximas verificações
Revisar `infra/master-admin/check-tailnet-route.py`, Compose, manifesto CI e owners, registrar linhas e resultados verificáveis, executar somente gates documentais em ambiente isolado. Qualquer preflight operacional exige autorização separada; não executar `--apply` nesta auditoria.

[STATUS](STATUS.md) · [OPERACAO](OPERACAO.md) · [ESCOPO](ESCOPO.md) · [Contratos públicos](../../standards/CONTRATOS-PUBLICOS.md)
