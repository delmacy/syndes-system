# I07 — Tailnet | auditoria GitHub-first (2026-11-13)

## Proveniência e limite
- Base `main` observada no GitHub MCP: `36e970768c8fc8cc36d519029b817af1e47f3c2f` (2026-11-13 14:44 UTC). Esta evidência vale para esse SHA, não para revisões futuras.
- Próxima unidade na ordem do plano: I07, após I06 (já parcialmente auditada). O catálogo contém 57 unidades (49 principais e oito componentes documentais); I07 é componente de I02.
- Fontes lidas no GitHub: `infra/master-admin/check-tailnet-route.py`, `docs/subprojects/I07-tailnet/{STATUS,REFERENCIA-TECNICA,OPERACAO,ESCOPO}.md`, plano geral e checkpoint I06.

## Código e contrato real encontrado
- O arquivo Python é um **validador local somente leitura** de JSON Tailscale Serve via stdin; não cria rotas, não configura Tailscale, não chama API externa e não autentica usuários.
- Função pública no arquivo `check(config, mode, port=9447, target="http://127.0.0.1:18085")` retorna `(bool, message)`; `main()` expõe CLI `--mode free|active`, `--port` e `--target`, com exit 0 (PASS) ou 2 (BLOCKED). Não há contrato de pacote Python/export formal comprovado.
- `free`: exige ausência de alocação da porta em TCP e de hostname Web com sufixo correspondente. `active`: exige exatamente uma rota Web, TCP HTTPS verdadeiro, handler exclusivo `/` com proxy para destino local exato e ausência de `AllowFunnel[hostname] == True`.
- `main` rejeita porta fora de 1–65535, destino diferente do literal autorizado e JSON inválido. Não imprime hostname.
- **Fronteira:** esse verificador é do caminho privado do frontend Platform Manager, não um proxy HTTP público de I06. Não demonstra ACL Tailnet, política efetiva de Funnel, acesso de clientes, firewall, TLS/certificados reais ou deployment.

## Lacunas e riscos de contrato
1. `check()` aceita qualquer valor de `mode` diferente de `free` como se fosse `active`; a CLI restringe as escolhas, mas chamadas diretas não. Exigir validação explícita se a função virar API reutilizada.
2. O predicado `hostname.endswith(':'+str(port))` e `len(matching)==1` verificam formato e unicidade no JSON recebido, não o ownership real do hostname ou a autenticidade da origem dos dados.
3. `AllowFunnel` ausente ou não-dicionário não é bloqueado; a ausência pode ser legítima no schema, mas a segurança da rota depende da semântica real do Tailscale, não só deste JSON. Confirmar schema e política antes de declarar fail-closed integral.
4. `active` não verifica a inexistência de outras chaves TCP, outros handlers em outras portas, ACL, certificados, DNS, processos de destino nem resposta HTTP; isso é propositalmente um teste restrito de rota dedicada.
5. O `REFERENCIA-TECNICA.md` ainda declara classes/contratos **A AUDITAR**, apesar de existir a função/CLI acima. Divergência documental identificada; requer revisão do owner antes de alterar canônicos.

## Classes, APIs, eventos, dados e testes
- Classes: nenhuma classe declarada no arquivo inspecionado; funções `check` e `main`.
- APIs HTTP, eventos, consumers, schemas SQL/migrations: não presentes **nesse arquivo**; não afirmar ausência em todo o repositório sem inventário exaustivo.
- Testes: **não executados**. Não houve inspeção de configuração Tailscale ativa, consultas de rede, credenciais, execução de scripts nem DevServer. A pesquisa textual GitHub MCP não retornou testes indexados para os termos consultados; isto **não prova** inexistência de testes.
- Documentação: baseline sem auditoria funcional; implementação: fonte encontrada; integração: não verificada; operação: não verificada; homologação: não comprovada.

## Próximos gates
1. Revisar os cinco riscos de contrato e verificar testes existentes e schema Tailscale Serve; adicionar testes unitários isolados em revisão autorizada.
2. Atualizar ficha técnica/STATUS e as oito matérias I07 **após** validação documental, preservando o baseline de escopo não aprovado.
3. Validar configuração efetiva, origem e políticas de acesso somente em janela autorizada; sem publicação de hosts, IPs, segredos ou configurações sensíveis.
4. Seguir para I08 após fechamento da revisão de I07. Nenhum gate operacional ou de Pages foi declarado aprovado nesta auditoria.

**Esta evidência é um checkpoint parcial em branch dedicada, não homologação nem alteração dos documentos canônicos.**
