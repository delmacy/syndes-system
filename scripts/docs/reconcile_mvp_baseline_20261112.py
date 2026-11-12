#!/usr/bin/env python3
"""Evidence-based MVP documentation snapshot, 2026-11-12. No runtime changes."""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
DATE="2026-11-12"
SHA="b452a03e9d8814e2c0aed9fc14bc742c3ff36bb9"
QUO=chr(96)
D={
"P01": {
"name":"CRM",
"summary":"Código de CRM com plugin NestJS, pessoa/organização, notas, tags, canais, CSV, SQL 001–003 e UI Workspace. Não comprovada nesta auditoria uma jornada autenticada real de CRM ou ativação multi-org.",
"files":["modules/core-crm/package.json","modules/core-crm/src/plugin.ts","modules/core-crm/src/crm.controller.ts","modules/core-crm/src/context-guard.ts","modules/core-crm/src/whatsapp-identity-events.ts","modules/core-crm/sql","apps/workspace-web/src/features/crm.tsx"],
"tests":"cd modules/core-crm && npm test — 29 PASS, 0 FAIL",
"block":["Keycloak/OpenFGA com memberships tenant/organização/workspace e negações 401/403 em HTTP e browser reais (WBS 50.02).","CRM-WA-01.03/04: vínculo transacional idempotente e revisão humana de ambiguidades; 14 propostas de contato não significam 14 vínculos criados.","SQL 002 continua travando multi-org; não remover ou migrar sem Product Gate, restore e autorização."],
"next":"Homologar CRM HTTP e Workspace com identidade real e tenant A/B, sem ativar multi-org.",
"tasks":[
("P01-VAL-01","50.02","Testar CRUD, consulta, CSV e notas com JWT/FGA reais","Control/tenant, Keycloak e FGA provisionados","E2E positivo e negativo A/B; SHA, ambiente e CI"),
("P01-VAL-02","CRM-WA-01.03/04","Especificar revisão de ambiguidades e vínculo idempotente","Event Worker gated e revisão autorizada","Replay, concorrência, grant e rollback em PG descartável"),
("P01-VAL-03","50.08","Homologar navegação CRM no Workspace e fechar Product Gate","P01-VAL-01/02 e restore real","Teste browser/teclado, isolamentos e aceite registrado")
]
},
"P02":{
"name":"Inbox",
"summary":"Plugin NestJS, fila, responsável, handoff, notas, mensagens, SSE e consumidores opt-in de evento WhatsApp/CRM. A operação autenticada e o layout real ainda exigem homologação.",
"files":["modules/inbox/package.json","modules/inbox/src/plugin.ts","modules/inbox/src/inbox.controller.ts","modules/inbox/src/realtime.ts","modules/inbox/src/whatsapp-event-consumer.ts","modules/inbox/src/crm-link-event-consumer.ts","apps/workspace-web/src/features/inbox.tsx"],
"tests":"cd modules/inbox && npm test — 34 PASS, 0 FAIL",
"block":["WBS 50.03: testar fila/handoff/resposta em browser com JWT Keycloak, FGA e tenant/workspace reais.","WBS 50.04: reproduzir identificação de contato e layout compacto em navegador antes de marcar correção concluída.","SSE em memória não é barramento replicado; consumers de eventos opt-in não garantem que o worker esteja rodando.","SQL 002 continua ativo; transferências e paths tenant-only legados exigem novo gate."],
"next":"Reproduzir a jornada Inbox autenticada com contato identificado, fila e atribuição; depois validar a ponte WhatsApp e CRM.",
"tasks":[
("P02-VAL-01","50.03","Verificar fila, handoff, notas e respostas com atores reais","Tenant, grants FGA e API reais","E2E com dois agentes, negativas 401/403 e auditoria"),
("P02-VAL-02","50.04","Reproduzir layout compacto, busca e identidade de contatos","Dados autorizados e P02-VAL-01","Comparação visual antes/depois + teste responsivo"),
("P02-VAL-03","IN-E01/02","Testar consumo de inbound e vínculo CRM sem duplicidade","WhatsApp worker gated, autorização e rollback","PG17 idempotente; staging e browser só após gates")
]
},
"P03":{
"name":"WhatsApp",
"summary":"Pacote TypeScript com contas, outbox, inbound, dispatch, contratos e migrations 001–008; gateway Go/Whatsmeow existe. O plugin consta em apps/core-host/config/modules.json, mas a inscrição não prova módulo habilitado por tenant nem projetor novo operacional.",
"files":["modules/whatsapp/package.json","modules/whatsapp/src/plugin.ts","modules/whatsapp/src/outbox.ts","modules/whatsapp/src/event-bridge.ts","modules/whatsapp/gateway/whatsmeow/go.mod","modules/whatsapp/sql/008_whatsapp_projection_owner.sql","apps/core-host/config/modules.json"],
"tests":"cd modules/whatsapp && npm test — 69 PASS, 0 FAIL; testes Go não executados",
"block":["Go/Whatsmeow: testes de gateway e persistência/quotas/contas não validados nesta auditoria.","WA-CUT07–10: migration 008 em staging, todas instâncias legadas compatíveis com filtro, canário e rollback — não ativar projetores concorrentes.","Grants FGA, identity service, tenant/org/workspace, restore e Control ENABLED reais permanecem gates.","Escopo de entrega atual textual; mídia completa permanece fora desta fatia."],
"next":"Homologar a rota textual segura por conta/tenant e preparar canário de projetor único apenas após restore real.",
"tasks":[
("P03-VAL-01","50.05; WA-DATA-01","Executar Go tests e fixtures de conta/callback","Toolchain Go, PG descartável e nenhuma credencial operacional","Go tests + negativas cross-tenant"),
("P03-VAL-02","50.05/06","Validar fluxo textual, idempotência, taxa e recovery","Conta ENABLED + autorização scoped","E2E textual e testes de retry/restart/duplicidade"),
("P03-VAL-03","WA-CUT07–10","Planejar cutover de único projetor com rollback","Migration 008/restore e versões legadas compatíveis","Canário sem dois donos para o mesmo inbound")
]
},
"P14":{
"name":"Platform Core",
"summary":"modules/platform-core contém AGENTS.md e NÃO é pacote runtime próprio. O Core executável está distribuído em packages/core-kernel, apps/core-host e unidades Control/Identity/Authorization. Perfil de composição por instância ainda não foi implementado.",
"files":["modules/platform-core/AGENTS.md","packages/core-kernel/package.json","packages/core-kernel/src/platform-events.ts","apps/core-host/src/module-host.ts","apps/core-host/src/platform-event-dispatcher.ts","apps/core-host/src/platform-event-worker-composition.ts","apps/core-host/config/modules.json"],
"tests":"cd packages/core-kernel && npm test — 35 PASS; cd apps/core-host && npm test — 63 PASS, 0 FAIL, 19 SKIP",
"block":["CMP-01/02: matriz de ports/contracts e schema offline de composição ainda pendentes na WBS.","CMP-03–09: perfis de instância, imagens/rollout/entitlements e gates não homologados.","Event Worker/scheduler, Control/tenant migrations, FGA service grants e restore real não ativados.","19 testes ignorados no Host NÃO são prova de integração PG17, staging, Keycloak ou FGA reais."],
"next":"Especificar CMP-01 e CMP-02 preservando Kernel (ports), Host (composição) e módulos (domínio), sem habilitar worker ou perfis reais.",
"tasks":[
("P14-CMP-01","CMP-01","Inventariar contratos públicos, adapters e exports existentes","Kernel, Host e registros instalados","Matriz coerente com package exports + teste de fronteira"),
("P14-CMP-02","CMP-02","Definir schema e validador OFFLINE de composição","P14-CMP-01","Perfis inválidos recusados, sem startup produtivo"),
("P14-EV-01","EV-W08–10","Detalhar gates de Event Worker e projetor único","Control/tenant, FGA/ENABLED, restore","Checklist aprovado; nenhum deploy ou SQL operacional")
]
}
}

def render_status(id,info,old):
    code=QUO
    lines=[f"# {id} — {info['name']} | STATUS","",
           f"> **AUDITORIA TÉCNICA PARCIAL — {DATE}.** Evidência: worktree {code}{SHA[:8]}{code}; testes locais sem implantação. NÃO equivale a CI da SHA publicada, integração real, deploy ou Product Gate.","",
           "## Situação revalidada","",info["summary"],"",
           "| Fonte | O que foi confirmado |","|---|---|"]
    for path in info["files"]:
        assert (ROOT/path).exists(),path
        lines.append(f"| {code}{path}{code} | Artefato presente no checkout; não implica runtime habilitado |")
    lines += ["","**Testes executados nesta revisão:** "+info["tests"]+".",
              "","## Bloqueios e limitações",""]
    lines += ["- "+b for b in info["block"]]
    lines += ["","## Próximo marco candidato (não comprometido)","",info["next"],"",
              f"**Planejamento:** [Evolução](EVOLUCAO.md) · [Sprint](SPRINT.md) · [Escopo](ESCOPO.md).",
              "","## Checkpoint da auditoria","",
              "| Data | Ambiente | Evidência | Lacuna |","|---|---|---|---|",
              f"| {DATE} | DevServer01 checkout {code}{SHA[:8]}{code} | Fonte e testes locais listados acima | Sem staging/CI da publicação, IAM real, restore e aceite |",
              "","## Histórico documental anterior (não confundir com auditoria atual)","",
              "> O texto abaixo foi escrito antes desta revisão e é preservado para reconciliação; seus estados podem estar desatualizados.",""]
    if old.startswith("# "):old="\n".join(old.splitlines()[1:]).strip()
    return "\n".join(lines)+old+"\n"

def evolution_append(id,info):
    lines=["",f"## Reconciliação técnica — {DATE}","",
           "> **Workpackage candidato; NÃO aprovado, atribuído ou iniciado.** Referências locais e resultados de testes devem ser checados contra a SHA do agente antes de editar código.","",
           "**Resumo do estado:** "+info["summary"],"",
           f"**Próximo marco recomendado:** {info['next']}","",
           f"### {id}-WP-VAL — Validação do incremento MVP (proposto)","",
           "| Task ID | WBS / plano relacionado | Entregável | Depende | Critério de aceite | Estado |",
           "|---|---|---|---|---|---|"]
    for task,wbs,goal,deps,accept in info["tasks"]:
        lines.append(f"| **{task}** | {wbs} | {goal} | {deps} | {accept} | CANDIDATA / NÃO ATRIBUÍDA |")
    lines+=["","### Dependências bloqueantes",""]
    lines+=["- "+b for b in info["block"]]
    lines+=["","**Rotina:** escolher **uma meta** na Sprint após resolver os gates; implementar apenas na unidade, executar testes afetados e registrar commit, CI, ambiente, evidências e pendências em STATUS. Não converter esta tabela em tarefas concluídas automaticamente.",""]
    return "\n".join(lines)

def sprint_append(id,info):
    first=info["tasks"][0]
    second=info["tasks"][1]
    return "\n".join(["",f"## Próxima sprint candidata — reconciliação de {DATE}","",
      "> **Ainda não iniciada.** Sem responsável, período, autorização ou Product Gate atribuídos.",
      "","**Meta proposta:** "+info["next"],"",
      "| Candidate task | Pré-requisito de início | Status |","|---|---|---|",
      f"| **{first[0]}** | {first[3]} | A PRIORIZAR / NÃO INICIADA |",
      f"| **{second[0]}** | {second[3]} | DEPENDENTE / NÃO INICIADA |",
      "","Critério de encerramento: meta aceita com testes, SHA/CI, ambiente, rollback e segurança aplicáveis; atualizar [Evolução](EVOLUCAO.md) e [STATUS](STATUS.md), sem iniciar outro pacote automaticamente.",""])

def main():
    catalog=json.loads((ROOT/"docs/subprojects/index.json").read_text())["units"]
    units={u["id"]:u for u in catalog}
    for id,info in D.items():
        folder=ROOT/Path(units[id]["scope"]).parent
        status=folder/"STATUS.md"
        old=status.read_text()
        if "## Situação revalidada" not in old:
            status.write_text(render_status(id,info,old))
        evo=folder/"EVOLUCAO.md"
        old=evo.read_text()
        if f"## Reconciliação técnica — {DATE}" not in old:
            evo.write_text(old.rstrip()+"\n"+evolution_append(id,info))
        sprint=folder/"SPRINT.md"
        old=sprint.read_text()
        if "## Próxima sprint candidata — reconciliação" not in old:
            sprint.write_text(old.rstrip()+"\n"+sprint_append(id,info)+"\n")
    print("Reconciled four priority modules with code paths, local test evidence and candidate WPs. No runtime changed.")

if __name__=="__main__":
    main()
