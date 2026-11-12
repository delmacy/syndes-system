# Integração GitHub Projects — estado e configuração

> **Integração preparada; autorização de Projects pendente.** O conector GitHub desta sessão administra Issues e commits, mas não expõe mutations de Projects. Portanto, não declarar o quadro preenchido sem confirmar no GitHub.

## Fontes e responsabilidades

- **GitHub Issues** com o label `syndes-docs-workpackage`: trabalho planejado e suas decisões, vinculadas a documentação canônica.
- **GitHub Projects V2:** visão de tabela, quadro e roadmap das Issues; o estado dos itens pertence ao Project, não é copiado para STATUS.md.
- **Syndes Docs:** especificação, contratos e timeline; link para Issue/Project, sem inventar prazo, responsável ou aceite.
- **Commits/CI/deploy:** evidências separadas e identificadas pelo SHA.

## Pré-requisitos para popular o Project real

O proprietário do Project (user-owned ou organization-owned) precisa autorizar a API do **GitHub Projects**. O `GITHUB_TOKEN` padrão das Actions não é suficiente para operações de Projects.

Na configuração do repositório, em **Settings → Secrets and variables → Actions**:

1. Criar a variável `SYNDES_PROJECT_URL` com o endereço **exato** do Project: `https://github.com/users/delmacy/projects/<numero>` (ou `orgs/<owner>/projects/<numero>` se o Project pertencer a uma organização).
2. Criar o secret `SYNDES_PROJECTS_PAT` com token específico de Projects e somente os escopos necessários. Para Projects do usuário, a API atual requer token clássico com acesso `project` (e acesso ao repo/Issues quando necessário); nunca colocar token em prompt, Markdown ou commit.
3. Em **Actions**, executar o workflow `Syndes Docs — sincronizar workpackages com GitHub Projects` primeiro com **dry_run=true**, inspecionar os IDs, depois com **dry_run=false** para fazer o backfill de Issues existentes.
4. Novas Issues com label `syndes-docs-workpackage` dispararão o workflow automaticamente, após a variável e o secret estarem configurados.

Sem essas credenciais, o workflow fica desativado pela ausência da variável e o Project **continua não sincronizado**. Nenhum status é inventado para contornar o limite.

## Formato da Issue de workpackage

Título recomendado: `[Syndes Docs][DOC-02] Inventário técnico verificável`. Corpo com problema, escopo exato, módulos, critérios de aceite, dependências e links para a documentação. Estados de conclusão são atualizados no GitHub após evidência verificável.

**Sincronizador idempotente:** `scripts/docs/sync_github_project.py` lista Issues com label, lista itens existentes e adiciona apenas os ainda ausentes. A atualização de status/iteração/assignee continua sendo feita no Project ou por integração futura **autorizada**. Não são criadas datas fictícias.

## Referências

- [GitHub — API de Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects)
- [GitHub — configurações de automação](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/adding-items-automatically)
- [Github Issues do Syndes](https://github.com/delmacy/syndes-system/issues)
