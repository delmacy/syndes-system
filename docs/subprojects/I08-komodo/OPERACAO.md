# I08 — Komodo | Operação

> **Runbook não homologado.** Nenhuma ação de deploy, configuração ou acesso ao ambiente está autorizada por este documento.

## Pré-condições para qualquer operação futura
1. Identificar o artefato exato, commit, owner, ambiente e autorização.
2. Verificar rede privada, proxy, TLS, identidade, permissões e trilha de auditoria.
3. Documentar volumes, dados, retenção, restore e rollback sem expor segredos.
4. Executar smoke/integração em ambiente autorizado e vincular logs sanitizados ao SHA.
5. Registrar aceite operacional em [STATUS](STATUS.md), separadamente do aceite documental.

## Estado observado
Leitura apenas de GitHub em `891559a` (2026-11-13). Fonte `infra` é genérica. Não foi comprovada instância Komodo, porta, endpoint, container, configuração, versão, disponibilidade ou conectividade Tailnet. Não executar comandos inferidos.

## Referências
[Referência técnica](REFERENCIA-TECNICA.md) · [Escopo e capítulos](ESCOPO.md) · [Sprint](SPRINT.md) · [Evolução/WBS](EVOLUCAO.md) · [Padrões de contratos](../../standards/CONTRATOS-PUBLICOS.md).
