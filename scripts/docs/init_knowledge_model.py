#!/usr/bin/env python3
"""Idempotent, verified first-pass docs. Does not replace audited references."""
from pathlib import Path
import json
from urllib.parse import quote
ROOT=Path(__file__).resolve().parents[2]
UNITS=json.loads((ROOT/"docs/subprojects/index.json").read_text())["units"]
REPO="https://github.com/delmacy/syndes-system"

def code(s):
    return "`"+s+"`"
def gh(p):
    return f"{REPO}/blob/main/{p}"

def technical(u):
    p=Path(u["source"]);full=ROOT/p
    if not full.exists():raise ValueError(str(p))
    manifest=full/"package.json" if full.is_dir() else None
    pkg=json.loads(manifest.read_text()) if manifest and manifest.exists() else None
    lines=[
      f"# {u['id']} — {u['name']} | Referência técnica","",
      "> **INVENTÁRIO DOCUMENTAL NÃO AUDITADO.** Só descreve arquivos/declarações presentes no repositório; não representa funcionalidade implantada.","",
      "## Stack e ownership","",
      f"- **Fonte:** [{p}]({REPO}/tree/main/{p}) — {'arquivo' if full.is_file() else 'diretório'}.",
      "- **Owner:** declarado em "+code("catalog/work-units.json")+". Contratos públicos de outros owners não podem ser alterados diretamente.",
    ]
    if pkg:
        lines.extend([f"- **Pacote:** {code(pkg.get('name','não declarado'))}.",
                      f"- **Manifesto:** [{p}/package.json]({gh(p/'package.json')})."])
        exports=pkg.get("exports",{})
        if isinstance(exports,dict) and exports:
            lines+=["","### Exports declarados no manifesto","","| Subpath | Alvo | Evidência |","|---|---|---|"]
            for key,value in sorted(exports.items()):
                val=json.dumps(value,ensure_ascii=False) if not isinstance(value,str) else value
                lines.append(f"| {code(key)} | {code(val.replace('|','/'))} | Declaração, não garantia de consumidor instalado |")
        scripts=pkg.get("scripts",{})
        if isinstance(scripts,dict) and scripts:
            lines+=["","### Scripts do pacote (não executados aqui)","","| Nome | Comando declarado |","|---|---|"]
            for name,cmd in sorted(scripts.items()):
                if isinstance(cmd,str):lines.append(f"| {code(name)} | {code(cmd.replace('|','/').replace('`',''))} |")
    else:
        lines.append("- **Stack/manifests:** não foi encontrado package.json nesta fonte; auditar o artefato antes de declarar framework.")
    lines+=["","## Backend: classes, métodos e responsabilidades","",
            "**A AUDITAR:** inspecionar código e testes, assinaturas, parâmetros, efeitos e erros. Não publicar API privada como contrato.",
            "","## Contratos públicos, APIs e eventos","",
            "[Índice normativo de contratos](../../standards/CONTRATOS-PUBLICOS.md). Imports, endpoints e consumers exigem evidência de export, versão e compatibilidade.",
            "","## Frontend: aplicações, telas e componentes","",
            "**A AUDITAR:** conferir telas em Workspace, Manager ou Support e componentes compartilhados; não inferir rota a partir do nome da unidade.",
            "","## Schemas e migrations","",
            "### Tenant DB","",
            "Tabelas e migrações precisam de ownership e prova de aplicação; arquivo SQL presente não equivale a mudança executada.",""]
    sql=sorted(full.glob("sql/*.sql")) if full.is_dir() else []
    if sql:
        lines+=["| Arquivo SQL encontrado | Banco/owner e estado |","|---|---|"]
        for file in sql:
            rel=file.relative_to(ROOT)
            lines.append(f"| [{file.name}]({gh(rel)}) | A confirmar com o manifesto de migração |")
    else:lines.append("Nenhuma migration em subpasta SQL nesta fonte; isso **não** comprova ausência de persistência.")
    lines+=["","### Control / Manager DB","",
            "Nenhuma tabela pode ser atribuída ao Control por inferência; confirmar owner e schema. Negócio do cliente fica no Tenant DB.",
            "","## Diagramas, testes e pendências","",
            "- [Escopo](ESCOPO.md) · [Evolução](EVOLUCAO.md) · [Status](STATUS.md) · [Histórico](HISTORICO.md).",
            "- **Próximo passo:** auditar classes/exports, contratos, telas, tabelas, testes e evidências sem inventar funcionalidades.",""]
    return "\n".join(lines)

def history(u):
    ident=u["id"];q=quote(f'is:issue "[Syndes Docs][{ident}]"',safe="")
    return f"""# {ident} — {u['name']} | Histórico

> **Histórico realizado, não cronograma.** Commits comprovam mudança de arquivo, não implantação, integração ou aceite. Gerado com a revisão Git do build do Pages.

## Decisões, mudanças e solicitações

- [Caixa de entrada](updates/README.md) e [Issues contextualizadas]({REPO}/issues?q={q}).
- [Workpackages planejados](EVOLUCAO.md), [Sprint](SPRINT.md), [Especificação](ESCOPO.md) e [Status](STATUS.md).
- ADRs aprovadas são versionadas em {code("docs/engineering/")}; versões substituídas permanecem históricas.

## Linha do tempo verificada no repositório

<!-- SYNDES-HISTORY-GENERATED -->

## Rastreabilidade dos incrementos

<!-- SYNDES-TRACE-GENERATED -->

## Testes, deploys e aceite

- [Monitoramento de workflows](../../monitoramento/README.md) · [GitHub Actions]({REPO}/actions).
- O histórico de commits **não fornece sozinho** aprovação, ambiente de deploy, E2E, migrações aplicadas nem aceite de produto. Evidências ficam em [STATUS.md](STATUS.md).
"""

def operation(u):
    p=u["source"];name=u["name"];ident=u["id"]
    return f"""# {ident} — {name} | Operação

> **ÍNDICE DE FONTES, NÃO RUNBOOK HOMOLOGADO.** Não executar migrations, alterar permissões ou ativar workers apenas com esta página.

## Estado operacional e evidências

- [STATUS](STATUS.md): nível de validação, bloqueios, testes, ambiente e SHA.
- [SPRINT](SPRINT.md): incremento autorizado e checkpoints, quando existentes.
- [Evolução](EVOLUCAO.md): workpackages e dependências; nenhum item é concluído por estar planejado.
- [Histórico](HISTORICO.md): commits de código e documentos.
- [Workflows GitHub](../../monitoramento/README.md): resultado CI geral, não estado operacional do módulo.

## Fontes e contratos

- [Código/artefato do módulo]({REPO}/tree/main/{p}) — {code(p)}.
- [Contratos públicos](../../standards/CONTRATOS-PUBLICOS.md).
- [Regras de rastreabilidade](../../standards/FONTES-DE-VERDADE-E-RASTREABILIDADE.md).
- **Runbook específico:** não verificado neste inventário. Não criar comandos de ambiente por inferência.

## Operações orientadas por agentes

- [Projeção / Planejamento](PROJECAO.md)
- [Implementação](IMPLEMENTACAO.md)
- [Alteração rápida](ALTERACAO.md)
- [Entrada de propostas](updates/README.md)

## Gates para operação real

1. Conferir fonte, tenant/org/workspace, ambiente, SHA e autorização explícita.
2. Validar identity/service grants e ownership de banco.
3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.
4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.
5. Registrar resultado e evidência em STATUS, sem confundir merge com deploy ou aceite.
"""

def main():
    made={"reference":0,"history":0,"operation":0}
    for u in UNITS:
        root=ROOT/Path(u["entry"]).parent
        items=[("reference","REFERENCIA-TECNICA.md",technical),
               ("history","HISTORICO.md",history),
               ("operation","OPERACAO.md",operation)]
        for kind,name,renderer in items:
            p=root/name
            if not p.exists():
                p.write_text(renderer(u),encoding="utf-8")
                made[kind]+=1
    print("Created missing source-backed pages:",made)
if __name__=="__main__":main()
