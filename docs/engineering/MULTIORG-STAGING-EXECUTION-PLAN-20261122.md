# Plano de execução — aceite multi-org no staging

Base: `96a20b5e3c4afda0612c5b99ac0589f50c2572c0`. Escopo: projeto Docker isolado `syndes-multiorg-staging` no DevServer01; produção bloqueada.

## Diagnóstico do 403 (MO-REL-05)

A primeira leitura autenticada `GET /v1/tenants/:tenant/inbox/conversations` para fundador/OrgA/A1 devolve 403 (Actions 44970952240). JWT `sub` coincide com o fundador e o check coarse OpenFGA `can_read` autoriza. A causa exata ainda não foi provada. O teste passa a emitir somente resultados booleanos e contagens de membership, resolução de escopo, estado do módulo e decisão de FGA, sem tokens ou dados pessoais. O marcador de diagnóstico só será emitido quando os gates forem avaliados; 403 permanece falha.

## Sequência e critérios

1. Executar diagnóstico somente por Actions com identidade sintética; registrar gate negador e SHA do run na issue #209.
2. Corrigir o componente responsável: catálogo/entitlement/instalação Control, membership/escopo tenant, FGA ou configuração do Core. Verificar allow A1 e deny A2/B2 sem grant, outro tenant e identidade B em A.
3. Rodar PR CI completo e merge somente com sucesso. O workflow de staging deve usar o mesmo Core image SHA verificado; se houver alteração no Core, publicar e fixar a nova imagem.
4. Executar HTTP/IdP/FGA/SQL/CRM/Inbox/Service/SSE/worker e revogações concorrentes, sem side effects externos. Falha em qualquer asserção bloqueia o aceite.
5. Fazer backup criptografado, restore de cinco DBs e OpenBao em destinos segregados, comparar dados e repetir aceite na mesma imagem. Medir RTO e registrar hashes/digest.
6. Remover diagnóstico transitório, executar CI/aceite finais, atualizar este documento, WBS e issues #208/#209/#210 com SHA, run/jobs e marcadores. Somente o marcador `STAGE_ACCEPTANCE_AND_ENCRYPTED_FIVE_DB_RESTORE_SAME_CORE_IMAGE_RECOVERY_PASS` autoriza declarar staging aprovado.

Rollback da aplicação: imagem anterior se /readyz falhar; restauração de dados apenas no staging com originais preservados. `PRODUCTION_GATE=BLOCKED`; SQL002 operacional, wizard e WhatsApp real fora deste aceite.
