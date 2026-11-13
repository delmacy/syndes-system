---
title: "G03 · Controle de escopo"
description: "Volume Infraestrutura e qualidade · capítulo G03 · matéria 07"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/chapters/07-controle-do-escopo.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 7. Controle de mudança, riscos e pendências

**Status das regras transversais:** o `AGENTS.md` raiz já estabelece restrições de MVP, segurança, testes e colaboração. Esta reconciliação G03 **não introduz nova política de proteção da main**, não cria PRD e não autoriza alteração em módulos.

| Divergência/riscos confirmados | Owner de solução | Encaminhamento permitido |
|---|---|---|
| CI mainline vermelho na prova de paridade, impedindo regressões | Q07 / frente de CI | Diagnosticar `scripts/ci/parity.test.mjs` e workflow **em escopo separado**; manter falha visível |
| Verificador de escopo documentado como *advisory* | G03 + owner do ambiente/CI | Definir, aprovar e testar controle impeditivo se necessário; **não** alegar que já existe |
| Project sync é condicional a variável/token | G03/proprietário do Project | Verificar permissões, itens e workflow; não declarar status sincronizado sem checagem |
| Alguns apps/packages não possuem `AGENTS.md` local | Owners afetados | Aplicar global e política local quando existir; proposta de cobertura depende de revisão |
| WBS histórica e fontes dinâmicas podem divergir | G02/G03 + owners | Preservar estados e SHA de origem, resolver lacunas por evidência, não sobrescrever silenciosamente |
| Artefatos de CI/teste e implementações de módulos não são iguais a deploy | Q10, Q07, Operação, Produto | Distinguir testes locais, mainline, instalação, smoke, homologação |
| GitHub Pages e Issues são públicos | G03/Segurança | Remover segredos, PII e caminhos administrativos sensíveis antes de publicar |

### Checklist de revisão

- [ ] Fonte e owner aprovados pelo responsável? **Pendente**.
- [x] Lidas regras globais e locais disponíveis e registrado escopo? **Sim, por leitura estática**.
- [x] Fluxo de CI, Projects e verificador identificados? **Sim, por arquivos**.
- [ ] CI central verde no SHA da mudança? **Ainda não comprovado**.
- [ ] Project sincronizado? **Não verificado nesta auditoria**.
- [ ] Deploy/aceite de produto? **Não aplicável à G03 como serviço**.

### Regras de continuação

Novo incremento precisa de owner, objetivo, risco, WBS e evidência. Não iniciar trabalho fora de G03, editar contratos de API, SQL, frontends de produto, branches protegidas ou configurações operacionais sem autorização específica. **A segurança do sistema não é uma opção**: controles tenant e autorização continuam de responsabilidade dos serviços de runtime.

A G03 pode permanecer com **auditoria parcial** até revisão técnica, CI saudável e confirmação de integração com GitHub Projects. A continuação documental segue Q10 antes de Q07, sem reduzir exigência de testes.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/chapters/07-controle-do-escopo.md).
