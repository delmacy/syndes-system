# Syndes Docs Reader — Next.js + Chakra UI

Aplicação editorial **nova e independente**, criada em `apps/docs-reader`. Não substitui o portal MkDocs nem altera a documentação canônica. O trabalho começa com a Home e o módulo-piloto **P01 CRM**.

## Arquitetura de leitura

- **Home**: visão humana do Syndes baseada no Blueprint, cinco volumes explicados sem expor inventários internos desnecessariamente.
- **/modulos/crm**: 12 assuntos contínuos, com índice lateral e âncoras; primeiro explicação, depois dados de apoio, **referências ao final**.
- **Propostas**: uma área por assunto; rascunhos somente em `localStorage` do navegador, exportáveis em Markdown ou copiados para revisão com IA. Não são enviados ao servidor, não criam Issues automaticamente e não executam implementações.
- **Fonte canônica**: `docs/subprojects/P01-crm/` e `docs/blueprint/`. A camada editorial é um protótipo de apresentação, não reescrita normativa.
- **Estados**: planejado, implementado, testado, integrado, operacional e homologado são conceitos distintos. O CRM permanece em auditoria parcial.

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

1. Validar a leitura visual e a interação no módulo CRM.
2. Aprovar a organização e a redação antes de adicionar outro módulo.
3. Definir a persistência autorizada das propostas (usuário, permissões, histórico, aprovação), integrando posteriormente GitHub Issues/PR ou serviço próprio.
4. Mover o site para domínio/infraestrutura definidos, sem misturar as sessões do produto com as da documentação.
