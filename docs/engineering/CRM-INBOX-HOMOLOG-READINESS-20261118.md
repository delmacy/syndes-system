# Homologação CRM/Inbox — inventário operacional somente leitura

Este inventário é uma verificação da infraestrutura operacional, não cria credenciais, permissões, tenants ou grants.

O script scripts/identity/homolog-readiness.py é transmitido por stdin usando GitHub Actions, Tailscale OIDC e SSH para o DevServer01, sem checkout, build ou publicação no servidor.

## Escopo e limites

- Confere a existência do registro privado da identidade de homologação e lê o sub imutável sem divulgá-lo.
- Consulta exclusivamente as contagens de tenants e memberships do principal na Control DB.
- Verifica se a conta Keycloak tem uma credencial configurada, mas nunca a consulta ou altera.
- Verifica os clientes OIDC syndes-crm-ui e syndes-inbox-ui: Authorization Code, PKCE S256, public client, direct grant desabilitado, redirects HTTPS exatos e origens HTTPS.
- Não altera membership, usuários, OpenFGA, PostgreSQL, Docker ou serviço de aplicação.
- O status active do tenant registry NÃO demonstra que um tenant seja exclusivo de homologação. Não vincular esse principal a um tenant comercial por conveniência.

Estado: auditoria implementada e coberta por testes, sem execução operacional. A ativação no GitHub Actions ainda não foi integrada: a tentativa de adicionar o job foi bloqueada pelo controle da ferramenta. O fluxo proposto seria independente do deploy e do preflight Compose, acionado apenas após CI verde da main.

A senha da identidade deverá ser definida pelo operador Keycloak via canal seguro. O endereço example.invalid não recebe e-mails de recuperação, portanto nenhum reset por e-mail é presumido.

O Product Gate P02 permanece OPEN até comprovação de tenant isolado de homologação, autorização mínima e revogável, testes reais OIDC PKCE/CRM/Inbox e backup/restauração operacional.
