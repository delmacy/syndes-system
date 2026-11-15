# I11 — Release e Rollback | Operação

> Runbook de leitura e verificação documental, **não autorização de implantação**. Auditoria estática de `infra/master-admin/homolog-deploy.sh` no blob `39f85b3ec07b92a90f3e83408c3ad2541ec6fcf3` (main `3a943ea`).

## Estado e limites
A fonte implementa gates declarados de preflight e apply do Platform Manager. Não há nesta revisão prova de preflight aprovado, CI, deploy real, smoke, login, rollback executado ou homologação. Consultar [STATUS](STATUS.md) para o estado por dimensão.

## Sequência lógica documentada (não executar)
1. Validar checkout aprovado, ferramentas, containers saudáveis, redes internas e owner de Control.
2. Verificar OpenBao, tmpfs e permissões de segredos, sem exibir valores.
3. Conferir proveniência do frontend pelo manifesto CI e SHA Git; bloquear fonte modificada.
4. Conferir hostname Tailnet, issuer OIDC e disponibilidade da porta HTTPS 9447.
5. No modo apply, criar runtime local, construir imagens, iniciar Compose isolado e aguardar frontend HTTP.
6. Registrar configuração Serve anterior, revalidar propriedade da porta e publicar somente rota Tailnet privada.
7. Verificar rota e registrar SHA implantado; solicitar smoke e login reais separadamente.
8. Em erro, o trap tenta desfazer apenas rota de propriedade do Manager e Compose Manager; revisão manual de efeitos residuais continua necessária.

## Gates antes de qualquer operação
Autorização explícita do responsável, identidade do host e SHA, ambiente aprovado, evidência do CI, plano de reversão, verificação de acesso privado, segregação de segredos e registro de aceite. A leitura desta página não autoriza execução de comandos, SQL, migrations ou alterações em Tailscale.

## Riscos e lacunas
- Rollback do script é **parcial** e não restaura banco ou estado externo.
- Checkouts e portas são específicos de ambiente; não reutilizar em produção por inferência.
- O preflight inclui consultas SQL e leitura de segredos do ambiente: não executá-lo como gate documental isolado.
- Um commit ou um `HOMOLOG_DEPLOY_COMPLETE` no código não comprova que a operação aconteceu.

## Evidências exigidas para promoção de estado
Resultado de gates documentais, revisão do owner, SHA do artefato CI, logs sanitizados de preflight, smoke privado, login e teste de reversão em ambiente autorizado, com data e responsável. Nenhum witness operacional foi acrescentado nesta revisão.

[Referência técnica](REFERENCIA-TECNICA.md) · [Evolução](EVOLUCAO.md) · [Histórico](HISTORICO.md) · [STATUS](STATUS.md)
