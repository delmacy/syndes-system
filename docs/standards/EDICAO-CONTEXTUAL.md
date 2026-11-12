# Edição contextual no Syndes Docs

> A documentação oficial fica no GitHub. O portal em GitHub Pages é estático e **não grava arquivos diretamente**.

## Alterar um tópico
1. Abra a página da unidade e selecione **Propor alteração neste tópico**.
2. A caixa apresenta o Markdown original do tópico. Selecione **Alterar**, **Acrescentar** ou **Remover** e edite o texto proposto.
3. Use **Copiar solicitação** para levar o texto ao chat, ou **Enviar à caixa de entrada** para abrir uma GitHub Issue já preenchida.
4. **Confirme e publique a Issue no GitHub.** Apenas abrir o formulário não salva a solicitação.
5. O agente, no chat autorizado, lê a Issue e o caminho Markdown indicado, analisa dependências públicas e prepara uma alteração. A edição do escopo aprovado só ocorre após autorização.

## Informações preservadas em cada solicitação
- Caminho exato do Markdown e identificação da unidade.
- Título do tópico, nível do cabeçalho e linha de origem.
- SHA de origem da documentação e texto original do trecho.
- Proposta e operação (alterar, acrescentar, remover).

## Limitações do MVP
- Um editor por seção/cabeçalho Markdown (não cada parágrafo).
- Os rascunhos no formulário **não possuem salvamento local automático**. Copie/registre antes de sair.
- Issues no repositório público também são públicas. **Não inserir credenciais, tokens, dados pessoais ou segredos.**
- Para textos longos, use **Copiar solicitação** e cole manualmente na Issue; URLs têm limites de comprimento.
- Para editar diretamente o documento oficial, use **Editar arquivo original no GitHub** e faça a alteração dentro das permissões do repositório.

O agente trata a Issue como proposta em avaliação, **não** como requisito automaticamente aprovado.
