# Starlight B — subcapítulos técnicos por módulo (13/11/2026)

Escopo documental **experimental**; não substitui `docs/subprojects` nem altera produto/serviços/CI.

## Nova estrutura

- Cinco volumes e 57 fichas de módulos preservados.
- Cada módulo apresenta 14 subcapítulos **separados por URL**: casos de uso, histórias de usuário, requisitos, contratos públicos/privados, APIs, eventos, dados, schemas/migrations, dependências, configuração, frontend, testes, operação e WBS.
- O conteúdo dos subcapítulos é uma projeção de ocorrências textuais das fontes `STATUS`, `REFERENCIA-TECNICA`, `OPERACAO` e capítulos originais. Os links e números de linha permitem revisão; a ocorrência lexical **não equivale a contrato implementado ou homologado**.
- Onde não existe evidência textual específica, a página expõe lacuna documental. Não foram acrescentadas funcionalidades ou APIs inventadas.
- A hierarquia do Starlight separa volume, módulo e subcapítulos, com navegação colapsável.
- As oito matérias canônicas continuam em páginas próprias, totalizando 448 páginas adicionais.

## Gates

- Build Starlight: 1.310 páginas, incluindo home, 5 sumários, 57 módulos, 448 matérias de origem, 798 subcapítulos técnicos e página 404.
- Testes Python docs: 126 aprovados; JavaScript navegação: 11 aprovados.
- Validador documental: 20 STATUS parciais e 37 baseline, 0 discrepâncias encontradas; witness AST/lexical sem erros detectados.
- MkDocs strict: build aprovado; os subcapítulos A06 de histórias, contratos, APIs, dados, schema e dependências foram verificados no artefato final.
- A conclusão de publicação exige commit remoto, workflow Pages bem-sucedido e GET público das novas páginas com conteúdo correspondente.

## Limites

As páginas orientam a leitura e revisão; não representam levantamento completo de APIs/classes/migrations, validação de privilégios ou prova de implantação. A documentação canônica e as 57 unidades continuam no escopo de auditoria técnica.
