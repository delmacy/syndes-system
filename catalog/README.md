# Catálogo de ownership

O Syndes é gerenciado por **cinco frentes executivas**, com **até três entregas ativas no projeto**. As unidades em [`work-units.json`](work-units.json) são responsabilidades de engenharia, **não** projetos independentes, microsserviços, bancos ou deployments.

GitHub Issues/Project é a fonte de verdade de tarefas, progresso e bloqueios: [índice #102](https://github.com/delmacy/syndes-system/issues/102). O catálogo mapeia somente onde trabalhar no código. Uma unidade pode compartilhar caminhos com outras.

`maturity`: `code` = fonte existente, não necessariamente operacional; `contract` = principalmente planejamento AGENTS; `distributed` = responsabilidade transversal; `verified` = componente observado; `partial` = operação incompleta; `unverified` = host não auditado. Nunca inferir DONE a partir deste inventário.

Ao alterar ownership: atualizar JSON, índice de módulos e AGENTS pertinentes; executar `bash tests/integrity/repository-structure.sh`; registrar o incremento em uma issue. **Não mover código por estética** nem mudar CI/deploy nesta frente. Migrações físicas requerem contrato de compatibilidade, testes dos consumidores e rollback.
