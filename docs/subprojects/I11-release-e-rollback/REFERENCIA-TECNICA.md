# I11 — Release e Rollback | Referência técnica

> Inventário estático, **não é contrato público homologado**. Fonte: [homolog-deploy.sh no main 696f8e59](https://github.com/delmacy/syndes-system/blob/696f8e59a369dba593681e82293e104bef0a6e08/infra/master-admin/homolog-deploy.sh), blob `39f85b3ec07b92a90f3e83408c3ad2541ec6fcf3`.

## Superfície e responsabilidades

Script Bash de implantação isolada do Platform Manager, com modos `--preflight` e `--apply`. O código restringe o checkout de origem, verifica dependências `docker`, `jq`, `tailscale`, `python3`, PostgreSQL, Keycloak, redes internas e OpenBao. **Não inferir** que os serviços estejam saudáveis em qualquer ambiente.

## Contratos e validações declarados

- PostgreSQL: o script contém consultas de verificação de role e owner. São dependências internas do gate, não uma API pública e não autorizam execução SQL nesta auditoria.
- Segredos: exige `/run` em tmpfs, diretório com modo 700, arquivo de conexão com modo 600 e UID específico; não copiar valores nem executar verificações operacionais.
- Artefato: requer manifesto `CI_ARTIFACT_MANIFEST.json`, `index.html`, commit de proveniência presente no histórico e ausência de alterações no frontend após o build CI.
- Identidade e rede: consulta DNS Tailnet, issuer OIDC do Keycloak e disponibilidade da rota privada na porta 9447 antes de aplicar.
- Rollback: escopo limitado ao Manager e sua rota/Compose; **não** constitui recuperação de dados, credenciais ou dependências externas.

## Interfaces, persistência e frontend

O arquivo auditado é um script de orquestração, não um pacote TypeScript com exports públicos. Não há evidência nesta fonte isolada para atribuir classes, endpoints REST, eventos, migrations aplicadas ou telas ao owner I11. Dependências citadas pertencem a outros owners e exigem verificação independente em [contratos públicos](../../standards/CONTRATOS-PUBLICOS.md).

## Estado de validação

| Aspecto | Estado |
|---|---|
| Presença da fonte | Confirmada no GitHub |
| Execução dos gates declarados | Não comprovada |
| Testes de integração e rollback | Não comprovados |
| Deploy e homologação | Não comprovados |
| Witness operacional | Não registrado |

Ver [STATUS](STATUS.md), [OPERACAO](OPERACAO.md) e [ESCOPO](ESCOPO.md). Esta referência não autoriza execução de `--preflight` ou `--apply`.
