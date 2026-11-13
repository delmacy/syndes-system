# Syndes · Prototipação A/B de biblioteca

A = VitePress, B = Astro Starlight. Mesma fonte para 57 capítulos em cinco volumes. Snapshot para avaliação da interface, não da completude técnica.

A execução `python3 scripts/docs/build_book_ab.py` gera dois projetos temporários. Para produzir os bundles HTML, execute `npm install` + `npm run build` em cada projeto e copie `vitepress/docs/.vitepress/dist` e `starlight/dist` para caminhos de prévia isolados. Não substituir MkDocs sem decisão explícita.

## Iteração editorial escolhida — Starlight B

Cada módulo possui **14 subcapítulos técnicos independentes**, incluindo casos de uso, histórias de usuário, contratos, APIs, eventos, dados, schema, dependências, configuração, interfaces, testes, operação e WBS. As oito matérias canônicas continuam acessíveis. A sidebar do Starlight agrupa volumes, módulos e páginas por tema.

Subcapítulos novos são **projeções de leitura**, com citações extraídas dos arquivos versionados. Resultado de busca textual é contexto, não homologação ou prova completa de contrato. Se faltar conteúdo, a lacuna fica explícita. Nenhuma fonte canônica é modificada pelo gerador.
