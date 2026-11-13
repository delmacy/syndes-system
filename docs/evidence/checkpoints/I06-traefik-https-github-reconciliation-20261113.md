# I06 — Traefik HTTPS | reconciliação GitHub-first (2026-11-13)

## Base e procedência

- Base GitHub `main`: `2b8086818f19ba1a05582f8a4f36133aa1eb7089` (versão de origem, não versão homologada).
- Inventário anterior: checkpoint local `a393007315e16114b31feb814cf89f8c8dceab96`, `docs/evidence/checkpoints/I06-traefik-https-initial-20261113-1100.md` — **ainda não incorporado ao main** no momento desta reconciliação; observações de runtime abaixo são reportadas por esse checkpoint, não reexecutadas aqui.
- Fonte principal verificada diretamente pelo MCP GitHub: `modules/whatsapp/deploy/devserver01-cutover.compose.yaml` (blob `ccfda4090ee84b9fb6011c071417ec90fcbdac56`), `modules/whatsapp/deploy/README.md` (blob `5084898c39f66121f3612a494483ec42c8dc1b04`), `docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md` (blob `c440d1c157c3b63fb552b255c22e3b80ae0d8983`).

## Contratos de configuração identificados

- Dois serviços de corte reversível com `traefik.enable=true`, rede declarada `infra-proxy` e middleware referenciado `syndes-tailnet-only@docker`.
- Router `syndes-core-whatsapp-v2`: prioridade 110; host+paths `/v1/` e `/modules/`; entrypoint **`web`**; destino interno 8082.
- Router `syndes-workspace-whatsapp-v2`: prioridade 2; host; entrypoint **`web`**; destino interno 80.
- Redes Compose marcadas `external: true`; os serviços dependem de sua existência externa. Esses campos não criam, por si, políticas efetivas de acesso.
- O README descreve rollback reversível do cutover; não autoriza executá-lo como etapa documental.

## Observação do ambiente — segunda fonte, com limites

O checkpoint técnico local informa Traefik `v3.6.25` em execução, rede `infra-proxy`, mapeamento das portas 80/443 em IPv4/IPv6 e quatro containers com labels Traefik, em inspeção read-only. Esses fatos **não** comprovam TLS, roteadores efetivos, firewall, allowlist Tailnet ou cobertura de todos os serviços. Configuração `/srv/syndes-lab/workspace.traefik.yaml` citada no runbook não foi localizada naquele host na verificação original; a divergência de origem/época continua aberta.

## Gates pendentes (sem execução/aceite nesta revisão)

1. Verificar configuração dinâmica/estática efetivamente carregada, entrypoints, TLS/certificados/redirect (sem acessar material secreto).
2. Verificar se `syndes-tailnet-only@docker` existe e aplica a restrição correta; testar negativa externa e acesso autorizado.
3. Confrontar labels efetivas dos quatro containers com configurações versionadas e validar prioridade/fallback.
4. Rastrear manifests locais do runbook e seu owner; reconciliar documentação legada.
5. Executar smoke de roteamento e certificado em ambiente autorizado, com SHA, horário e critérios de aceite; verificar rollback sem executá-lo nesta auditoria.

**Classificação:** documentação em auditoria parcial; implementação declarativa existente; integração e operação não homologadas. Não há classes, eventos, APIs de negócio ou migrations de propriedade I06 demonstrados por essas fontes; não preencher registry AST com símbolos artificiais.
