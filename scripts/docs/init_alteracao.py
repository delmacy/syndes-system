#!/usr/bin/env python3
"""Create concise per-unit alteration prompts without modifying approved requirements."""
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[2]
UNITS=json.loads((ROOT/"docs/subprojects/index.json").read_text(encoding="utf8"))["units"]

def build_prompt(u):
    folder=Path(u["scope"]).parent.as_posix()
    source=u["source"]
    local=ROOT/source/"AGENTS.md"
    local_context=(source+"/AGENTS.md") if local.is_file() else "AGENTS.md (instruções globais)"
    return f"""# SYNDES — ALTERAÇÃO RÁPIDA · {u['id']} — {u['name']}

> Copie para um chat com acesso ao repositório. **Este prompt não aprova requisitos novos.**

**Módulo exclusivo:** {u['id']} — {u['name']}
**O que alterar:** [DESCREVA A MUDANÇA X EM UMA OU DUAS FRASES]
**Assunto exato:** [CAMINHO DO MARKDOWN E TÍTULO/ÂNCORA; se houver]
**Referências diretas:** `{folder}/ESCOPO.md` · `{folder}/STATUS.md` · `{folder}/SPRINT.md`.
**Código do proprietário:** `{source}`.
**Regras:** `AGENTS.md` · `{local_context}` · contratos públicos em `docs/standards/CONTRATOS-PUBLICOS.md`.

**Instrução:** altere apenas o item solicitado em {u['id']}, após conferir o comportamento atual e os contratos públicos necessários. Não modifique outros módulos, não instale bibliotecas redundantes e não aumente o escopo. Faça os testes afetados, registre a alteração e evidências no STATUS e pare. **Se faltar decisão, houver risco de quebra de contrato, migration ou requisito novo, não implemente: apresente o impedimento e encaminhe para Projeção/Planejamento.**
"""

def main():
    count=0
    for u in UNITS:
        root=ROOT/Path(u["scope"]).parent
        p=root/"ALTERACAO.md"
        if p.exists():
            continue
        p.write_text(build_prompt(u),encoding="utf8")
        readme=root/"README.md"
        content=readme.read_text(encoding="utf8")
        if "ALTERACAO.md" not in content:
            content+="\n8. **Alteração rápida:** [Prompt curto por módulo](ALTERACAO.md).\n"
            readme.write_text(content,encoding="utf8")
        count+=1
    print("Created",count,"alteration prompts")

if __name__=="__main__":
    main()
