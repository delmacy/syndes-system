## 4. Contratos e dependências públicas

**Contrato externo do C03:** OIDC do Keycloak (Authorization Code, token, JWKS e discovery). O provedor não publica API de negócio Syndes. URI exata/realm live **não auditados**.

| Consumidor | Contrato | Dependência e negativa de acesso |
|---|---|---|
| Manager Web A02 | `login`, `finishLogin`, `/master-runtime.json`, endpoints padrão OIDC | PKCE, `state`; qualquer callback fora da sessão é rejeitado |
| Workspace Web A01 | `beginLogin`, `finishLogin`, `/workspace-runtime.json` | PKCE, tenant UUID de runtime; validação verdadeira de autorização é backend |
| Manager API A05 | `createMasterTokenVerifier` | `iss`, `aud`, `azp`, `sub`, JWKS RS256; depois verifica operador no Control |
| Account API A06 | `createTokenVerifier` | audience/client dedicado; decisão de escrita no OpenFGA |
| Core Host A04 | `ActorVerifier.verifyClient`, `ActorVerifier.verify` | JWT RS256; `verifyClient` exige `azp`, `verify` recusa Master sem exigir client único |

**Erros e limites observados:** tokens inválidos geram exceção de verificador; controladores convertem em 401 ou negam operação conforme o owner. Issuer HTTPS é exigido no Manager/Account (config), e um JWT válido não implica membership/entitlement.

**Eventos:** não foi identificado contrato de evento de domínio próprio do C03 em `infra/security-access`. Eventos tenant em C06 e trilhas de autorização pertencem a outros owners; não inventar publisher/consumer Keycloak.

**Public/private:** métodos de clientes OIDC nos frontends e verificadores de APIs são implementação interna dos respectivos pacotes, **não SDK público C03**. OpenBao/Keycloak admin secrets, arquivo renderizado e política de provisionamento são contratos privados de operação.

**Versões:** não afirmar compatibilidade sem comparar manifests, realm/clients de homologação e testes da imagem implantada. C03 não possui API versionada NestJS no repositório.
