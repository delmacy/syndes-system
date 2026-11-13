# Syndes — Starlight B: módulo contínuo com índice de âncoras

Data: 2026-11-13. Escopo: edição **experimental de leitura**, não substituição da documentação canônica nem implementação funcional.

## Modelo editorial

- Cinco volumes e 57 módulos. Cada módulo corresponde a **uma única página Starlight/Markdown**.
- Quatorze subcapítulos por módulo (casos de uso, histórias, requisitos, contratos, APIs, eventos, dados, schemas/migrations, dependências, configuração, frontend, testes, operação, WBS), agora seções `h2` na mesma página, com âncoras verificadas.
- Índice no corpo da página e índice lateral direito do Starlight (`tableOfContents` nível 2); navegação principal mantém os volumes e módulos.
- As oito matérias documentais versionadas são reproduzidas integralmente num apêndice da mesma página, preservando hiperlinks para o arquivo-fonte.
- Cada subcapítulo tem link de **edição do arquivo-fonte GitHub** e um painel de registro de alterações: proposta, referência de código, evidências/testes, aceite e status. GitHub Pages é estático, portanto esses formulários **não gravam alterações diretamente**; deve-se editar a fonte versionada.
- O gerador mantém idempotência comprovada em duas execuções sucessivas; não duplica seções. Não há criação de contratos inexistentes nem promoção de STATUS parcial a homologação.

## Gates

- Build Starlight: 64 páginas (home, cinco volumes, 57 módulos contínuos e página 404).
- Testes Python `scripts/docs`: 125 aprovados; testes JS da navegação: 11 aprovados.
- `scripts/docs/audit_consistency.py --check`: 20/57 parciais, 37 baseline, zero divergências dos validadores; AST/lexical sem problemas detectados.
- `mkdocs build --strict --clean`: aprovado; A06 presente no artefato publicado e URL antiga de API removida do artefato de publicação.
- Verificados no HTML A06 os destinos `#apis`, `#historias-de-usuario` e `#schema`, o espaço de ajustes e links de edição para fontes GitHub.

## Limites

A documentação continua em auditoria. O conteúdo espelhado contém evidências de fonte, não comprovação de deploy, banco, permissões ou integração operacional. Publicação remota requer workflow Pages com sucesso **e prova pública** de âncoras/versão.
