# Projetos e acompanhamento do Syndes

> **Painel de navegação sobre a WBS e os registros versionados.** O inventário associa tarefas do programa a unidades técnicas; **associação não é atribuição**, e o portal não calcula percentuais de avanço nem inventa status. Para o estado de execução, abra STATUS, SPRINT e o GitHub Project verificado.

## Visão do programa {#visao-geral}

<div id="syndes-projects" class="syndes-projects">
  <div class="syndes-projects-summary" aria-label="Resumo verificável dos registros">
    <div><strong class="syndes-projects-unit-count">—</strong><span>Módulos e unidades principais</span></div>
    <div><strong class="syndes-projects-task-count">—</strong><span>IDs únicos associados à WBS</span></div>
    <div><strong class="syndes-projects-source">—</strong><span>Fonte: WBS versionada</span></div>
  </div>
  <div class="syndes-projects-filters">
    <div><label for="syndes-projects-search">Módulo, código ou tarefa</label><input type="search" id="syndes-projects-search" placeholder="P03, WhatsApp, 50.05…" /></div>
    <div><label for="syndes-projects-area">Área do sistema</label><select id="syndes-projects-area"><option value="">Todas as áreas</option></select></div>
  </div>
  <p role="status" class="syndes-projects-state">Lendo o snapshot versionado da WBS…</p>
  <div class="syndes-projects-results"></div>
</div>

## Fontes de acompanhamento {#fontes-de-acompanhamento}

| Necessidade | Fonte confiável | Limitação |
|---|---|---|
| Escopo e pacote relacionado | **Evolução** de cada módulo e [WBS mestre](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Vínculo não comprova owner exclusivo nem execução |
| Compromisso de sprint | **SPRINT.md** por módulo | Necessita revisão e atualização pela equipe |
| Código, testes, bloqueios e gates | **STATUS.md**, testes e histórico do módulo | Commit não comprova implantação |
| Tarefa e responsável em execução | [GitHub Issues](https://github.com/delmacy/syndes-system/issues) e [GitHub Projects](https://github.com/users/delmacy/projects) | **A sincronização com Projects não foi confirmada**; conferir o quadro real antes de confiar nos campos |
| Relação entre requisitos e evidências | [Registro de rastreabilidade](../standards/FONTES-DE-VERDADE-E-RASTREABILIDADE.md) | Evidência ausente permanece ausente |

## Gestão e evolução do projeto {#gestao}

A página permite localizar o planejamento, as dependências, a sprint e a evidência de cada módulo, e abrir a Issue apropriada. A execução e o replanejamento **não ocorrem diretamente no site público**. A configuração da sincronização está em [integração GitHub Projects](../standards/GITHUB-PROJECTS.md), e as pendências da própria documentação em [workpackages e Issues de documentação](PROJETO-E-WORKPACKAGES.md).

**Para ampliar esta visão a um monitor operacional:** habilitar a sincronização autorizada do GitHub Project e consumir um snapshot de status real com datas, owners e gates. Sem isso, um gráfico percentual seria enganoso.
