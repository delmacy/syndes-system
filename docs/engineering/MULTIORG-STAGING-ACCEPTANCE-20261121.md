# Staging multi-org — implantação e recuperação no DevServer01

**Escopo autorizado:** concluir o ambiente isolado de staging, sem promover produção.
**Estado:** IN_PROGRESS; provas de execução devem ser registradas abaixo antes de declarar pronto.
**Fonte inicial:** main `7e9e85857629486dbb98abe325a528ebe17da02f`.

## Fronteira de implantação

- Projeto Docker `syndes-multiorg-staging`, rede interna própria, nenhum endpoint público.
- PostgreSQL17, Keycloak26, OpenFGA persistente, OpenBao TLS e Core Nest real.
- Dados e identidades exclusivamente sintéticos. Nenhum gateway WhatsApp operacional é conectado.
- Core sem root, filesystem read-only, cinco módulos com catálogo/entitlements verificados e Service opt-in de staging.
- Apenas GitHub Actions aplica alterações; imagem e scripts fixados por SHA e manifest.
- `history_sync` continua 403 no modo multi-org: excluído do piloto por não possuir comando remoto durável autorizado.

## Critérios reproduzíveis

| Critério | Evidência exigida |
|---|---|
| Identidade e segredos | HTTPS issuer/JWKS, leitor KC sem escrita, SQL mínimo, AppRoles próprios, produção/cross-role negados e bootstrap token revogado |
| Core verdadeiro | Imagem exata, `/readyz`, usuário 10001, segunda instância recusada pelo lease PostgreSQL |
| Módulos | Descritores com schema canônico, checksum de SQL e Control lifecycle; Service existente pós-cutover verificado separadamente, sem fingir replay de SQL002 |
| HTTP A/B | CRM, Inbox e Service reais; IDs conhecidos/CSV de outro escopo negados; tenant sem memberships/módulos negado |
| Revogação e SSE | FGA deny, Keycloak membership removida, fence/epoch revogado; nenhuma escrita; stream fechado e reconectado após restauração explícita da fixture |
| Worker WhatsApp | Inbound sintético e dedup no worker executado pelo Core; organização arquivada sem efeito externo; nenhuma conta/credencial real |
| Provider down | Keycloak/OpenFGA pausados somente no staging; JWT válido não autoriza escrita |
| Recuperação | Backups criptografados, cinco DBs restaurados em destinos separados e todas as tabelas comparadas por contagem/hash; snapshot raft OpenBao AES-GCM restaurado |
| Retorno funcional | Originais arquivados, restores assumem nomes canônicos, mesmos vínculos/credenciais/FGA, mesma imagem Core reiniciada e aceite HTTP completo repetido |

## Operação, rollback e limites

O instalador da aplicação recua à imagem anterior quando `/readyz` falha. Migrações aditivas não são removidas por rollback de imagem. O ensaio de dados primeiro valida os restores em bancos separados, preserva cada original por rename e tem compensação para recolocar os originais caso o aceite falhe. Não recria os índices SQL002 sobre dados com múltiplas organizações.

OpenBao possui raft persistente, TLS e AppRoles separados. O material de recuperação 1-de-1 permanece apenas no diretório protegido deste host de desenvolvimento; não é desenho de recuperação aprovado para produção. Backups de staging ficam criptografados no host; retenção externa e custódia fora do servidor continuam requisitos de produção.

Este aceite não libera wizard de signup, número WhatsApp real, acesso público, múltiplas réplicas do Core, carga de produção ou piloto comercial. `PRODUCTION_GATE=BLOCKED`.

## Evidências desta execução

Preencher com links dos workflows, SHA/digest real, marcadores, RTO e resultado final. Uma etapa não é comprovada por presença de código ou CI verde de componentes.
