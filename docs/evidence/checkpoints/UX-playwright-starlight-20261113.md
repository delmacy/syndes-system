# Syndes — Auditoria UX da Biblioteca Starlight com Playwright

Data: 2026-11-13. Alvo efetivamente testado: `https://delmacy.github.io/syndes-system/assets/experimentos/livros/b/`. Teste no navegador Chromium do GitHub Actions, não apenas análise estática.

## Execução

- PR de testes: [#115](https://github.com/delmacy/syndes-system/pull/115)
- Workflow: [Syndes Docs UX — Playwright, run 43463878747](https://github.com/delmacy/syndes-system/actions/runs/43463878747)
- Artefato com relatório HTML, screenshots, vídeo e traces: [syndes-docs-ux-playwright](https://github.com/delmacy/syndes-system/actions/runs/43463878747/artifacts/14057003349)
- Runner: Ubuntu 24.04, Node 22, Playwright 1.56.1, Chromium 141; viewports Desktop Chrome 1440×900 e iPhone 13 em Chromium.
- **14 testes executados: 8 passaram, 6 falharam** (3 cenários de UX × 2 viewports). CI falhou corretamente; não há homologação.

## O que passou nos dois viewports

1. Biblioteca → Volume II → A06: navegação principal carregou e chegou ao módulo.
2. Links de âncora de conteúdo presentes na página apontam para elementos existentes.
3. Página A06 não apresentou overflow horizontal global nos viewports medidos.
4. Navegação biblioteca→volume→A06→#contratos sem `pageerror` grave de JavaScript.

## Falhas observadas nos dois viewports

1. **Conteúdo ainda fragmentado**: a página pública A06 contém `Linha 7:` e trechos lexicais (blocos do gerador antigo). Falha no requisito de Markdown integral no lugar da matéria.
2. **Índice não corresponde ao contrato atualizado**: âncora `#estado` ausente dentro do artigo, impedindo o contrato de navegação completa das 17 seções.
3. **Controle editorial desatualizado**: o texto `Espaço para alterações` não aparece na versão servida (a versão antiga usa `Espaço para ajustes e implementação`).

Essas falhas são coerentes com a **revisão pública ainda apresentando a edição anterior**, mesmo após o merge [#113](https://github.com/delmacy/syndes-system/pull/113), commit `cb7744b5b27f1066e05056396e3de328bbd12912`. É necessário verificar o workflow de publicação Pages desse SHA e sua saída real antes de classificar cada falha como bug do novo gerador.

## Ações prioritárias

1. Confirmar build, upload, deploy e revisão publicada no GitHub Pages do SHA `cb7744b5`. Não confundir HTTP 200 com versão certa.
2. Reexecutar a suíte Playwright contra a revisão efetivamente publicada. Gate exige **14/14** ou justificativa técnica documentada para qualquer ajuste de teste.
3. Inspecionar screenshots/traces e comparar leitura desktop/mobile, especialmente índice lateral, legibilidade dos blocos extensos e comportamento de âncoras.
4. Manter o teste isolado de produto/infra; não alterar estados de homologação dos 57 módulos.

O teste verifica UX de navegação do portal em A06, não a correção integral de todos os contratos do Syndes.
