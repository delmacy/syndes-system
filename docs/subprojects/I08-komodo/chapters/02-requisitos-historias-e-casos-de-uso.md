# 02 — Requisitos, histórias e casos de uso (I08)

**Requisitos candidatos, não aprovados:** somente operadores autorizados devem poder visualizar estado e executar ações explicitamente permitidas; operações sensíveis exigem trilha auditável, acesso privado e recuperação documentada.

**Caso de uso proposto:** operador consulta serviços gerenciados; o sistema verifica identidade e autorização; uma ação autorizada registra responsável, alvo, ambiente, resultado e rollback. **Não existe fluxo implementado comprovado nesta auditoria.**

**Critérios pendentes:** identidade, menor privilégio, segregação de ambientes, observabilidade, isolamento de rede, auditoria e testes de restauração. Nenhum desses requisitos está aceito ou homologado.
