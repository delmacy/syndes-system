# Syndes Docs Reader — Next.js + Chakra UI

Aplicação editorial **nova e independente**, criada em `apps/docs-reader`. Não substitui o portal MkDocs nem altera a documentação canônica. O trabalho começa com a Home e o módulo-piloto **P01 CRM**.

## Arquitetura de leitura

- **Home:** diretório inicial de cinco áreas: CRM P01, Core Platform P14/A08/A04, Blueprint Geral, WhatsApp P03 e Security C03/C04/C05.
- **/modulos/crm:** piloto aprofundado, com funções, 18 fichas de operação, nove abas mutuamente exclusivas e Atlas Técnico com APIs, métodos, SQL e diagramas.
- **/modulos/core-platform, /modulos/blueprint, /modulos/whatsapp, /modulos/security:** leitura estruturada por função/ação com nove abas exclusivas, diagramas conceituais, fontes e prompts de planejamento/implementação.
- **Observações:** rascunhos locais por ação/subtópico em `localStorage`, exportáveis em Markdown; **não são aprovados ou registrados no GitHub automaticamente**.
- **Templates canônicos:** `docs/standards/TEMPLATE-FICHA-MODULO.md` e `TEMPLATE-FICHA-ACAO.md`. A estrutura documental é preenchida **progressivamente**, sem instanciar os demais módulos.
- **Fonte canônica:** documentos em `docs/subprojects/`, código/contratos e `docs/blueprint/`. A UI é uma forma de consulta/decisão, não fonte concorrente de aprovação.
- **Estados:** planejamento, implementação, teste, integração, implantação, operação e aceite têm evidências independentes.

## Execução

No diretório `apps/docs-reader`:

```bash
npm install
npm run test
npm run build
npm run dev
```

O pacote é isolado, sem imports das aplicações `workspace-web` ou `platform-manager`. O Next.js App Router utiliza Chakra UI v3; o Vercel deve apontar o **Root Directory** para `apps/docs-reader`.

## Publicação experimental

O projeto Vercel independente `syndes-docs-reader` foi criado (root `apps/docs-reader`), mas a primeira tentativa de deploy foi bloqueada por limite diário de deployments do plano. Não modificar configurações de cobrança para contornar isso.

**Fallback aprovado:** exportar o mesmo Next.js como conteúdo estático no GitHub Pages, em `https://delmacy.github.io/syndes-system/assets/docs-reader/`. O pipeline documental define `NEXT_PUBLIC_READER_BASEPATH=/syndes-system/assets/docs-reader`, executa `next build` com `output: "export"` e publica o diretório `out` como subpasta isolada. A persistência local das propostas funciona sem backend, mas elas não sincronizam entre dispositivos. Na migração posterior para Vercel/servidor, retirar a variável de exportação reativa o Next convencional.

## Próximos passos

1. Adotar a Ficha Mestre apenas nos cinco núcleos prioritários, começando pelo módulo escolhido pelo proprietário.
2. Relacionar ações à decisão, aos arquivos do owner, aos testes e aos diagramas sem duplicar fontes.
3. Definir persistência autenticada das decisões, quando autorizada; o site estático não pode gravar no repositório com segurança.
4. Reconciliar cada alteração executada com código, requisitos, STATUS, WBS e diagramas antes de iniciar novo chat.
