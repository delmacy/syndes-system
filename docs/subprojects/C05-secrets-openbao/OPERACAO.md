# C05 — Secrets OpenBao | Operação

> **RUNBOOK DE AUDITORIA, NÃO PROCEDIMENTO APROVADO DE PRODUÇÃO.** O container versionado estava Up no DevServer01 (13/11/2026); **não foi acessado** o cofre ou seu estado lógico. Nenhum comando de `init`, `unseal`, `raft snapshot`, política, rotação ou provisionamento foi executado.

## Verificações futuras — somente com autorização operacional

1. Registrar SHA/digest do serviço, TLS CA/SAN, health/initialized/sealed do ambiente **sem divulgar segredo ou topologia privada**.
2. Verificar em ambiente autorizado a presença e versão de KV, AppRole, políticas mínimas por workload, restrições negativas e registro de auditoria; guardar evidência sanitizada e segregada.
3. Validar arquivos tmpfs, permissões, atomicidade do renderer, escopo de rede, expiração e revogação de tokens. A ausência de secrets em logs/compose/metadata requer prova específica.
4. Separar os consumers efetivamente migrados (Core Host, Manager, PostgreSQL, Keycloak, OpenFGA) por ambiente; não extrapolar do código/README. Testar restart/reload, rotação e fallback recusado.
5. Preparar backup off-host e exercício de snapshot/restore do Raft, custódia de recovery/unseal, procedimento de rollback e aprovação de segurança antes de registrar operação homologada.

## Limites

- Nunca copiar shares/tokens, certificados privados, credenciais, conteúdos KV ou arquivo de runtime para Git, artefatos de CI ou documentação.
- Nunca utilizar o smoke descartável `tests/platform/openbao-smoke.sh` contra volume real: o script inicializa um cofre de teste e usa identidade descartável.
- O renderer é uma ação com efeitos de escrita de arquivos. **Não foi executado.**
- O Product Gate exige aprovação dos owners e evidência do ambiente-alvo.

[Referência técnica](REFERENCIA-TECNICA.md) · [Status](STATUS.md) · [Evolução](EVOLUCAO.md) · [Sprint](SPRINT.md) · [Projeção](PROJECAO.md) · [Implementação](IMPLEMENTACAO.md) · [Alteração](ALTERACAO.md) · [Runbook upstream](../../../infra/security-access/openbao/README.md).
