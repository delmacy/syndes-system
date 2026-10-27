# Ordem de trabalho Syndes

Use este contrato para transformar um requisito aprovado em issue, tarefa ou handoff executável. Omita somente campos comprovadamente inaplicáveis.

## Identificação

- ID e título
- módulo e gate
- classificação: `BLOCKER`, `BUG`, `MVP` ou `POST-MVP`
- prioridade, estado e responsável
- issue, branch, commit-base e PR, quando existirem

## Intenção e limites

- objetivo e contexto
- escopo incluído
- escopo excluído
- dependências e pré-condições
- arquivos ou áreas prováveis
- arquivos permitidos e proibidos quando houver ownership concorrente
- contratos consumidos e contratos que podem ser alterados

## Resultado verificável

- critérios de aceite observáveis
- regras de negócio e invariantes
- autorização, tenant isolation, auditoria e tratamento de dados aplicáveis
- testes unitários, integração, segurança, E2E ou performance exigidos
- comandos de validação e resultado esperado
- jornada demonstrável quando houver comportamento de usuário

## Evidência e encerramento

- arquivos modificados
- resultados dos testes e checks
- migrations e estado do banco, quando aplicável
- screenshots, logs ou links estritamente necessários
- riscos residuais e dívida técnica registrada
- decisão do revisor e correções solicitadas
- próximo responsável e próximo gate

## Regras

- Não misture módulos funcionais diferentes na mesma ordem.
- Não aceite expansão silenciosa de escopo.
- Não enfraqueça testes para obter CI verde.
- Não exponha secrets nas evidências.
- Se a tarefa alterar contrato compartilhado, identifique todos os consumidores e exija revisão compatível com o impacto.
