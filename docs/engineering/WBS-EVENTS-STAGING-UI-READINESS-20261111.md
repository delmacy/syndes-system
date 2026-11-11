# Syndes — WBS de visualização frontend e ativação controlada de eventos (2026-11-11)

**Objetivo:** permitir revisão visual **agora**, sem confundir container respondendo HTTP 200 com event bus ativo ou módulos homologados. Não alterar o trabalho não commitado no checkout principal (UX Workspace).

## Situação verificada no DevServer01 (somente leitura)

| Superfície | Evidência local | Limitação |
|---|---|---|
| Workspace React (CRM, Inbox, WhatsApp, Overview) | `127.0.0.1:18084/` HTTP 200; runtime HTTP 200 | Imagem instalada pode não refletir mudanças não commitadas de outros chats; acesso externo Tailnet deve ser verificado pelo usuário |
| Platform Manager | `apps/master-admin-web` existe no `main` e usa `packages/front-shared`; contêiner visual em `127.0.0.1:18086/` HTTP 200 | **visual-demo-no-auth**; rota Tailnet 9446 configurada, mas teste HTTPS do servidor expirou, exigindo confirmação da máquina cliente |
| Core Host | `127.0.0.1:18083/readyz` HTTP 200 | é o Host do fluxo legado, não prova que novos workers estejam ligados |
| Control Plane | `syndes_control` PostgreSQL 17, 1 tenant; migrations 001–006 **PENDING** | não aplicar sem backup e restore ensaiado |
| Tenant | `public` CRM/Inbox/WhatsApp existentes; **platform_events ausente** | migration 001 e constraint 002 ainda pendentes; nenhum publisher operacional |

Runbook existente: `docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md`.
Workspace para usuários **conectados à rede privada autorizada**:
`https://delmacy-desktoppc.tayra-delta.ts.net:9443/`.
Prévia do Manager: Tailscale Serve tem rota configurada `https://delmacy-desktoppc.tayra-delta.ts.net:9446/` → loopback 18086, mas o teste HTTPS pelo próprio servidor expirou (HTTP 000); **não afirmar acesso remoto confirmado** nem promover visual demo como painel autenticado.

## Contagem de etapas: zero para visualizar, quatro para fluxo integrado

| Fase | Entrega/aceite | Situação | Bloqueio |
|---|---|---|---|
| **0 — Preview visual** | Abrir as telas existentes de Workspace e Manager; revisão de UX independente de outbox | **Disponível localmente** | Manager ainda é demo sem auth; acessos externos nas portas 9443/9446 exigem teste na máquina Tailnet |
| **1 — Staging e dados recuperáveis** | Backup comprovado e restore real ensaiado de Control DB e tenant; release SHA/ledger e migrations PostgreSQL em **staging autorizado** | Bloqueada operacionalmente | Sem evidência de restore; tenant event schemas ausentes e Control 001–006 pendentes |
| **2 — Worker autorizado** | Identidade técnica provisionada, FGA + módulo ENABLED reais, scheduler com discovery por registry e failure/recovery PG17 | Código de dispatcher no main, **runtime não provisionado** | Control DB e grants/identidades |
| **3 — Cutover textual ensaiado** | Canary por tenant, um projetor ativo por inbound, rollback seguro, sem duplicar mensagens; revisão/retentativa/observabilidade | Pendente | Fase 1–2, políticas de retenção e reconciliação |
| **4 — Demo ponta a ponta no frontend** | Teste com usuário autorizado passando mensagem texto → Inbox → CRM → vínculo existente; erro CRM não interrompe WhatsApp; novo frontend somente para requisitos aprovados | Pendente | Fases 1–3, smoke autenticado e Product Gate |

**Manager funcional** requer trilha independente: o `main` contém `apps/master-admin-web` e `packages/front-shared`, mas o contêiner visual atualmente implantado é **sem autenticação e com dados fictícios**. A API real, Keycloak, grants de owner e isolamento precisam de homologação própria. Não acoplar sua UX à prontidão do Event Bus nem criar elementos não aprovados.

## Ferramenta instalada na PR

`python3 scripts/events/staging_preflight.py --json`

- Só executa `BEGIN TRANSACTION READ ONLY` e `ROLLBACK` em Control DB e tenant databases nomeados pelo registro confiável, com imagem PostgreSQL local e queries fixas.
- Verifica schemas, versão PG17, ledger de migrations, restrição de versionamento e HTTP local de Workspace/Manager/Core.
- Não aplica migration, não consulta payloads, não imprime nomes/IDs de tenant nem segredos e **não aprova backup/restore, FGA ou implantação automaticamente**.
- `--strict` retorna código não-zero até o gate operacional (intencionalmente), para impedir que checklist incompleto seja tratado como autorização.
- Testes sem conexão: `python3 -m unittest scripts/events/test_staging_preflight.py -v`.

## Dependências e preservação

- **Manter single-context SQL002** e o isolamento database por tenant. Não ligar multi-org.
- **Não executar** DDL/DML no Control/tenant operacional, nem deploy, alteração de GitHub Actions ou mudança de frontend de outro chat.
- Não ligar ponte WhatsApp e projetor legado simultaneamente. Sem auto-criação dos 14 contatos.
- O gateway WhatsApp textual atual permanece como está até canary e rollback homologados.
- Nenhuma autorização de worker pode ser presumida a partir da posse do evento.

## Próximo passo

Registrar evidências de backup/restore real com operador responsável e plano de reversão. Somente então provisionar e testar migrations em staging, sem tocar tenant operacional; a revisão visual pode começar independentemente.
