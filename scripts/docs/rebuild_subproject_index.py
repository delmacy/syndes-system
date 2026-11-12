#!/usr/bin/env python3
"""Generate source-backed human directory while keeping legacy unit paths."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def main():
    units=json.loads((ROOT/"docs/subprojects/index.json").read_text())["units"]
    names={u["id"]:u for u in units}
    groups=[
      ("Produto e integrações",lambda u:u["front"]=="produto"),
      ("Operação e negócio",lambda u:u["front"]=="operacao"),
      ("Plataforma e Core",lambda u:u["front"]=="plataforma"),
      ("Frontends e experiência",lambda u:u["front"]=="frontend"),
      ("Infraestrutura e hospedagem",lambda u:u["id"].startswith("I")),
      ("Qualidade e testes",lambda u:u["front"]=="qualidade" and not u["id"].startswith("I")),
    ]
    out=[
      "# Syndes Docs — mapa de módulos",
      "",
      "> **Uma entrada principal por capacidade ou responsabilidade.** O menu destaca módulos e áreas, enquanto componentes, hosts, gateways e ferramentas permanecem consultáveis dentro do módulo responsável. Os IDs técnicos antigos continuam válidos.",
      "",
      "## Encontrar rapidamente",
      "",
      "- **[Catálogo pesquisável: stack, APIs, classes, frontend e banco](../blueprint/CATALOGO-MODULOS.md)**.",
      "- **[Linha do tempo e workpackages](../blueprint/PROJETO-E-WORKPACKAGES.md)**.",
      "- **[Comandos e ancoragens para agentes](../standards/BUSCA-PARA-AGENTES.md)**.",
      "",
    ]
    visible=[u for u in units if not u.get("documentationParent")]
    hidden=[u for u in units if u.get("documentationParent")]
    for title,pred in groups:
        selected=[u for u in visible if pred(u)]
        if not selected:continue
        out += ["## "+title,"", "| ID e módulo | Home e links internos | Stack / contratos | Evolução |",
                "|---|---|---|---|"]
        for u in selected:
            base=Path(u["entry"]).parent.name
            out.append(f"| **{u['id']} — {u['name']}** | [Abrir home]({base}/README.md) | [Referência]({base}/REFERENCIA-TECNICA.md) | [Workpackages]({base}/EVOLUCAO.md) |")
        out.append("")
    out += [
      "## Componentes e históricos preservados",
      "",
      "> A tabela abaixo é **acervo técnico**, não entradas adicionais da navegação principal. Use a home do módulo pai para novos requisitos.",
      "",
      "??? info \"Expandir componentes legados, hosts e ferramentas\"",
      "",
      "    | Componente histórico | Pertence a | Fonte/documento |",
      "    |---|---|---|",
    ]
    for u in hidden:
        parent=names[u["documentationParent"]]
        base=Path(u["entry"]).parent.name
        pbase=Path(parent["entry"]).parent.name
        out.append(f"    | {u['id']} — {u['name']} | [{parent['id']} — {parent['name']}]({pbase}/README.md) | [Acervo]({base}/REFERENCIA-TECNICA.md) |")
    out+=["","**Regra de ownership:** a navegação não reatribui código nem finaliza tarefas. Validações, entregas e contratos continuam pertencendo a seus owners e gates reais.",""]
    path=ROOT/"docs/subprojects/README.md"
    path.write_text("\n".join(out),encoding="utf8")
    print("Updated human module index",len(visible),"visible,",len(hidden),"component records")
if __name__=="__main__":main()
