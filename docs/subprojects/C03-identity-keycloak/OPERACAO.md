# C03 — Identity Keycloak | Operação e gates

> **NÃO É RUNBOOK HOMOLOGADO.** Auditoria somente leitura em 13/11/2026. Não autoriza editar realm, clients, redirects, Keycloak, banco, token, OpenBao nem reiniciar serviços.

## Evidência operacional disponível

- DevServer01: Keycloak `26.8.1` identificado como container **Up**. Imagem/versionamento seguem `infra/security-access/compose.yaml`, mas **não** foi executado teste HTTP OIDC, login de navegador ou consulta autenticada ao realm.
- Segurança: `openbao` oferece secret config em runtime, sem publicar valores. O Keycloak declara banco técnico próprio. O Compose não é atestado de configuração do deploy.
- Staging, produção, sessões de operadores, recovery e isolamento A/B: **NÃO VERIFICADOS**.

## Procedimento de verificação proposto — sujeito a autorização

1. Identificar versão/digest da imagem em uso, overrides do Compose, origem HTTPS, issuer e cadeia de certificados; reunir **metadados sem segredos**.
2. Validar em leitura autenticada e auditada clients de Manager/Workspace/Account, PKCE S256, redirectUris exatos, webOrigins, audience mappers, flags implicit/direct grants e service accounts.
3. Executar testes negativos usando identidades de teste autorizadas: Manager→tenant 401/403, Workspace→Manager 401, `iss`/`aud`/`azp` inválidos e `sub` sem grant no Control/FGA.
4. Comprovar health, logs higienizados, chaves JWKS/rotação, políticas de sessão/logout, desativação de usuário, reset, recuperação, backup/restore e rollback de client.
5. Associar provas por SHA + ambiente, owner e decisão de segurança antes de alterar status para integração validada ou homologação.

## Operações sensíveis mantidas fora desta auditoria

- `infra/master-admin/keycloak-homolog.py`: `--check` é modo de inspeção; `--apply` cria/ajusta client conforme script e `--rollback` usa registro privado. Exigem operador autorizado e análise de risco.
- `infra/master-admin/keycloak-redirect-migrate.py`: operação de redirect com `--apply`/`--rollback`; não invocar sem janela, origem correta e rollback aprovado.
- Não ativar Direct Access Grants no client de browser real; a suíte `platform-manager-keycloak-ci.mjs` os habilita apenas em **realm descartável**.
- Não copiar tokens, senhas, secret files nem detalhes de topologia privada para esta documentação.

## Fontes

[Referência técnica](REFERENCIA-TECNICA.md) · [STATUS](STATUS.md) · [SPRINT](SPRINT.md) · [Evolução](EVOLUCAO.md) · [Projeção](PROJECAO.md) · [Implementação](IMPLEMENTACAO.md) · [Alteração rápida](ALTERACAO.md) · `infra/security-access/compose.yaml` · `tests/platform/platform-manager-keycloak-ci.mjs`.

**Próximo gate:** C03.SEC.01 + C03.SEC.02, com revisão cruzada de C01 Control, C04 FGA, A04 Core Host, A05 Manager, A06 Account e A01/A02 frontends. Nenhuma alteração de infraestrutura foi executada.
