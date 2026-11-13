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

Vercel com projeto independente: `syndes-docs-reader` (root `apps/docs-reader`), sem associar o domínio de produção da plataforma. Uma URL `.vercel.app` é adequada para testes. A futura migração para um servidor próprio deverá manter o mesmo pacote Next.js.

## Próximos passos

1. Validar a leitura visual e a interação no módulo CRM.
2. Aprovar a organização e a redação antes de adicionar outro módulo.
3. Definir a persistência autorizada das propostas (usuário, permissões, histórico, aprovação), integrando posteriormente GitHub Issues/PR ou serviço próprio.
4. Mover o site para domínio/infraestrutura definidos, sem misturar as sessões do produto com as da documentação.
