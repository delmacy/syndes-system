# Syndes · Prototipação A/B de biblioteca

A = VitePress, B = Astro Starlight. Mesma fonte para 57 capítulos em cinco volumes. Snapshot para avaliação da interface, não da completude técnica.

A execução `python3 scripts/docs/build_book_ab.py` gera dois projetos temporários. Para produzir os bundles HTML, execute `npm install` + `npm run build` em cada projeto e copie `vitepress/docs/.vitepress/dist` e `starlight/dist` para caminhos de prévia isolados. Não substituir MkDocs sem decisão explícita.
