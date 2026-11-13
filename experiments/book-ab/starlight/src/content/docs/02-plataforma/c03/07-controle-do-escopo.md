---
title: "C03 · Controle de escopo"
description: "Volume Plataforma e core · capítulo C03 · matéria 07"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/chapters/07-controle-do-escopo.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 7. Controle do escopo

- **Baseline técnico:** fontes `origin/main` `ac8deb8c538f59364c6247964a5b0d42e5fbae2e` em 13/11/2026; C03 `maturity=distributed` no catálogo é inventário, não estado DONE.
- **Estado:** documentação auditada parcialmente, implementação encontrada, integração com CI descartável e observação limitada de container; produção, homologação e aceites não verificados.
- **Permitido nesta etapa:** leitura de fontes, inventário de nomes de configuração, mapeamento de contratos por owner e testes documentais que não modificam ambiente.
- **Não permitido sem aprovação separada:** alterações em clients/realm, redirects, grupos, usuários, sessão, OpenBao, FGA, migrations, aplicação de scripts `--apply`, restart, deploy ou exposição pública de endereços/segredos.
- **Fronteira de ownership:** autorização por membership/grant é C01/C04 e consumidores A04/A05/A06; frontends A01/A02 controlam PKCE. C03 não deve assumir APIs ou tabelas dos outros owners.
- **Mudanças futuras:** Issue/WBS própria, revisão de segurança e avaliação de regressão E2E; manter distinção IMPLEMENTED ≠ INTEGRATED ≠ PROVEN ≠ DONE.

**Pendência de aceite:** o owner deverá aprovar requisitos operacionais como rotação, revogação e backup/restore; propostas de validação não se tornam escopo aprovado por terem sido escritas.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C03-identity-keycloak/chapters/07-controle-do-escopo.md).
