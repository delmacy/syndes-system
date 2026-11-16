# Syndes Docs Reader — Next.js + Chakra UI

Aplicação editorial **nova e independente**, criada em `apps/docs-reader`. Não substitui o portal MkDocs nem altera a documentação canônica. O trabalho começa com a Home e o módulo-piloto **P01 CRM**.

## Arquitetura de leitura

- **Home:** diretório inicial de seis áreas: CRM P01, Core Platform P14/A08/A04, Blueprint Geral, WhatsApp P03 e Security C03/C04/C05.
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

1. Adotar a Ficha Mestre apenas nos seis núcleos prioritários, começando pelo módulo escolhido pelo proprietário.
2. Relacionar ações à decisão, aos arquivos do owner, aos testes e aos diagramas sem duplicar fontes.
3. Definir persistência autenticada das decisões, quando autorizada; o site estático não pode gravar no repositório com segurança.
4. Reconciliar cada alteração executada com código, requisitos, STATUS, WBS e diagramas antes de iniciar novo chat.

## Leitor da Ficha Mestre v1.0.0 (CRM e P05)

- O portal carrega os documentos reais `docs/subprojects/P01-crm/FICHA-MODULO.md` e `docs/subprojects/P05-gestao-de-atendimentos/FICHA-MODULO.md` durante o build Next.js, por `lib/master-dossiers.js`.
- Apresentação em `components/master-dossier-reader.jsx`: 22 seções em 5 grupos, uma seção por vez, busca e tabelas Markdown. Links relativos são resolvidos para arquivos canônicos do GitHub.
- Rotas: `/modulos/crm/ficha` e `/modulos/atendimentos`. O CRM preserva suas seis funções e 18 ações; P05 é **piloto de Ficha Mestre**, sem alegar 12 fichas A–J ou Product Gate.
- **O portal reflete um snapshot de build**, não sincronização live. Commit novo exige novo build e deploy.

## GitHub Pages — Next.js como portal principal

- A raiz pública `https://delmacy.github.io/syndes-system/` publica o HTML exportado pelo Next.js, com `NEXT_PUBLIC_READER_BASEPATH=/syndes-system`.
- O MkDocs continua gerando referências técnicas para `/subprojects/*`, `/standards/*` e demais rotas históricas. A antiga página inicial permanece em `/legado/`.
- URLs antigas do leitor Next em `/assets/docs-reader/*` são redirecionadas para as rotas novas. Não manter uma segunda cópia dos bundles Next.
- O script `scripts/docs/publish_next_root.py` compõe o artefato somente **após** o build MkDocs e gera `.nojekyll`, preservando `_next`.
- Esta é uma **exportação estática**, não uma aplicação Node.js em execução no Pages. Funções que precisam de servidor, gravação ou sincronização em tempo real devem usar backend próprio em ambiente autorizado.

## P02 Inbox — Ficha Mestre e 19 ações detalhadas (16/11/2026)

- Rota de Ficha Mestre: `/modulos/inbox/`, 22 seções agrupadas em cinco áreas reutilizando `master-dossier-reader.jsx`.
- Ações por função: `/modulos/inbox/acoes/`, sete grupos, cada grupo mostra apenas suas próprias ações, com busca local.
- Fichas de ação: `/modulos/inbox/acoes/<actionId>/`, com 10 seções A–J (Markdown `docs/subprojects/P02-inbox/acoes/`). Exportação estática por `generateStaticParams()` para 19 IDs aprovados no catálogo editorial `ACOES.json`.
- Conteúdo é lido de Markdown/JSON no build Next.js, sem sincronização live nem backend de documentação duplicado.
- **P02 permanece NÃO HOMOLOGADO:** 17 decorators HTTP + 2 consumers identificados no código, sem ativar worker, migration, grants, deploy ou Product Gate.
