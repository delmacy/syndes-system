# C03 — Identity Keycloak | STATUS

> **AUDITORIA TÉCNICA PARCIAL — 13/11/2026.** Fonte de código: `origin/main` SHA `ac8deb8c538f59364c6247964a5b0d42e5fbae2e`; consolidação documental iniciada após C01 `f64a38c`. Observação **somente leitura** do DevServer01 (sem consulta de usuários, tokens, realm administrativo ou credenciais). Nenhum cliente OIDC, redirect, segredo, API, banco ou container foi alterado. Staging e produção **não verificados**.

## Situação por eixo independente

| Eixo | Evidência confirmada | Limite |
|---|---|---|
| Documentação | **Auditoria parcial**: fontes, consumidores OIDC, métodos, fluxos, rede, testes e lacunas mapeados | Revisão e aprovação do owner pendentes |
| Implementação | Keycloak Compose `26.8.1`; PKCE S256 em Manager/Workspace; validação RS256 por JWKS no Manager, Account e Core Host | Fonte no Git não comprova configuração do realm existente |
| Integração | Testes unitários com JWKS e tokens assinados; CI Keycloak descartável com testes negativos `aud`/`azp` | Sem fluxo navegador + Keycloak + Control/tenant real homologado nesta revisão |
| Operação | Container `syndes-security-access-keycloak-1` observado **Up** no DevServer01 em 13/11 | Estado do container não comprova readiness, HTTPS público, client, realm ou login funcional |
| Segurança | `iss`, `aud`, `azp`, `sub` e assinatura verificados em APIs específicas; Manager exige grant no Control | Validação por rota e políticas efetivas de clients/redirects exigem prova operacional |
| Product Gate | **Não aprovado** | Sem teste E2E A/B, grants reais, recuperação/rotação ou homologação de produção |

## Fronteiras confirmadas no código

- **C03 / Keycloak:** autentica identidades OIDC; banco técnico `syndes_keycloak` (não é o banco Control nem de tenants).
- **A02 / Manager Web:** `readConfig`, `login`, `finishLogin` e `clearLogin` usando Authorization Code + PKCE; configuração de runtime própria.
- **A01 / Workspace Web:** `getWorkspaceConfig`, `beginLogin`, `finishLogin`, `markSignedOut`; client público separado e callback validado por `state`.
- **A05 / Manager API:** `createMasterTokenVerifier` exige assinatura RS256, issuer HTTPS, audience e client `azp`; `platform_operator_access` é gate independente.
- **A06 / Account API:** `createTokenVerifier` devolve actor e recusa client Master; autorização de papéis de Account ocorre no OpenFGA, **não no Keycloak**.
- **A04 / Core Host:** `ActorVerifier.verifyClient` valida `azp` específico; `verify` genérico veta Master, mas não equivale à seleção explícita de um client Workspace.
- **C04 / OpenFGA e C01 / Control:** autorização, membership e grants separados da autenticação. Token válido não basta para acessar dados.

## Divergências e riscos a tratar

1. **P0 — configuração real não reconciliada:** Compose e testes descrevem o esperado, mas não foram lidos de forma autenticada os clients, audiences, redirects, realm e mapper efetivos do Keycloak do DevServer01.
2. **P0 — isolamento entre aplicações requer E2E negativo:** provar token Manager→Workspace negado, Workspace→Manager negado e sujeito sem grant→403 com dados A/B reais; a CI sintética não fecha esse gate.
3. **P1 — escopo de `ActorVerifier.verify`:** o caminho genérico do Core Host impede client Manager, porém não impõe um `azp` Workspace específico; confirmar os call sites e a autorização posterior antes de ampliar exposição.
4. **P1 — configuração versus runtime:** o Compose define ausência de porta pública; a instância observada tem binding local de loopback. Inventariar overrides e origem de exposição HTTPS sem publicar topologia sensível.
5. **P1 — operação de identidade:** faltam evidências de health OIDC real, rotação/expiração de chaves, sessão/logout, revogação, backup/restore Keycloak e resposta a incidentes.
6. **P1 — clients mutáveis:** scripts de homologação e migração de redirect possuem modos de escrita; nenhuma aplicação ou rollback está autorizada por esta auditoria.

## WBS e checkpoint

| ID | Estado | Critério de avanço |
|---|---|---|
| C03.DOC.01 | **AUDITORIA PARCIAL** | Owner revisar matriz e evidências |
| C03.SEC.01 | **PENDENTE** | Leitura autenticada, segura e somente leitura dos metadados de realm/clients no ambiente-alvo |
| C03.SEC.02 | **PENDENTE** | Matriz de aceitação/rejeição real por `iss`/`aud`/`azp`/`sub`, grants e isolamento |
| C03.OPS.01 | **PENDENTE** | Runbook Keycloak, saúde, atualização, rotação, backup/restore e rollback testados |

- **13/11/2026:** inspecionados arquivos versionados e estado limitado do container Keycloak, sem dados privados. Testes de documentação/contrato são evidência da revisão, **não** Product Gate.
- **Próxima unidade documental:** C04 — Authorization OpenFGA, após registrar C03 com suas lacunas.

[Referência técnica](REFERENCIA-TECNICA.md) · [Operação](OPERACAO.md) · [Capítulos](ESCOPO.md).
