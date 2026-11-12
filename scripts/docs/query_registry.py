#!/usr/bin/env python3
"""Source-backed lookup for Syndes agents. Does not call network or require a site build."""
from pathlib import Path
import argparse
import json
import sys
from code_inventory import open_source_symbols,REPO,ROOT

CATALOG=ROOT/"docs/subprojects/index.json"
def search(units,module=None,symbol=None,method=None,route=None,table=None,frontend=None,area=None,include_components=False):
    results=[]
    terms=dict(symbol=symbol,method=method,route=route,table=table,frontend=frontend)
    for u in units:
        if module and u["id"].lower()!=module.lower():continue
        if area=="infraestrutura" and not u["id"].startswith("I"):continue
        if area=="qualidade" and (u["front"]!="qualidade" or u["id"].startswith("I")):continue
        if area and area not in ("infraestrutura","qualidade") and u["front"]!=area:continue
        if not module and not include_components and u.get("documentationParent"):continue
        d=open_source_symbols(u)
        matches={}
        categories={
            "symbol":d["declared"]+d["go"],
            "method":d["methods"],
            "route":d["routes"],
            "table":[dict(name=t["name"],file=f["file"],line=t["line"]) for f in d["sql"] for t in f["tables"]],
            "frontend":d["frontendCandidates"],
        }
        for name,term in terms.items():
            if not term:continue
            value=term.casefold()
            candidates=categories[name]
            def target(item):
                if name in ("symbol","method","table"):
                    return item.get("name","")
                if name=="route":return " ".join((item.get("decorator",""),item.get("argument","")))
                return item.get("file","")
            matches[name]=[x for x in candidates if value in target(x).casefold()]
            if not matches[name]:break
        else:
            results.append(dict(moduleId=u["id"],name=u["name"],source=u["source"],
                                parent=u.get("documentationParent"),matches=matches,
                                inventoryCounts={k:len(v) for k,v in categories.items()}))
    return results
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--module",help="Exact module ID, e.g. P03")
    p.add_argument("--symbol",help="Class/interface/type name")
    p.add_argument("--method",help="Method name")
    p.add_argument("--route",help="Nest controller decorator or argument")
    p.add_argument("--table",help="Declared SQL table")
    p.add_argument("--frontend",help="Frontend file name")
    p.add_argument("--area",choices=["produto","operacao","plataforma","frontend","qualidade","infraestrutura"])
    p.add_argument("--include-components",action="store_true")
    p.add_argument("--json",action="store_true")
    args=p.parse_args()
    u=json.loads(CATALOG.read_text(encoding="utf-8"))["units"]
    rows=search(u,args.module,args.symbol,args.method,args.route,args.table,args.frontend,args.area,args.include_components)
    if args.json:print(json.dumps({"count":len(rows),"results":rows},ensure_ascii=False,indent=2))
    else:
        for row in rows:
            print(f"{row['moduleId']} — {row['name']} [{row['source']}]")
            for category,matches in row["matches"].items():
                for item in matches:
                    line=item.get("line")
                    loc=f"{REPO}/blob/main/{item['file']}"+(f"#L{line}" if line else "")
                    print("  "+category+": "+item.get("name",item.get("className",item.get("decorator",item.get("file",""))))+" · "+loc)
        print("Total:",len(rows),"módulos. Declarações identificadas não significam contrato público/deploy.")
    return 0
if __name__=="__main__":sys.exit(main())
