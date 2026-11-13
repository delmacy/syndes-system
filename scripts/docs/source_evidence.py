#!/usr/bin/env python3
"""Compare curated documented symbol witnesses against current source files.

Default lexical mode is a lightweight structural alarm, not type checking.
--ast uses the TypeScript compiler AST and fails closed if parser is unavailable.
"""
from pathlib import Path
import argparse
import json
import re
import os
import subprocess

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT/"docs/evidence/contract-witnesses.json"
AST_TOOL=ROOT/"scripts/docs/typescript_ast_inventory.mjs"

def validate(root=ROOT, ast=False, typescript_package_json=None):
    manifest=json.loads((root/"docs/evidence/contract-witnesses.json").read_text())
    issues=[]
    entries=manifest["witnesses"]
    if len(set(x["id"] for x in entries))!=len(entries):
        issues.append("Duplicate contract witness IDs")
    ast_rows={}
    if ast:
        filenames=sorted({x["source"] for x in entries if x["source"].endswith((".ts",".tsx"))})
        env=os.environ.copy()
        if typescript_package_json:
            env["SYNDES_TYPESCRIPT_PACKAGE_JSON"]=str(typescript_package_json)
        run=subprocess.run(["node",str(root/"scripts/docs/typescript_ast_inventory.mjs"),*filenames],
                           cwd=root,capture_output=True,text=True,env=env)
        if run.returncode:
            return [{"code":"ast-unavailable","details":run.stderr.strip() or run.stdout.strip()}]
        output=json.loads(run.stdout)
        ast_rows={x["file"]:x for x in output["files"]}
    for witness in entries:
        sid=witness["id"]
        source=root/witness["source"]
        doc=root/witness["document"]
        if not source.is_file() or not doc.is_file():
            issues.append(f"{sid}: missing source/document path")
            continue
        name=witness["symbol"]
        text=source.read_text()
        if ast and witness["source"] in ast_rows:
            record=ast_rows[witness["source"]]
            if record["parseDiagnostics"]:
                issues.append(f"{sid}: TypeScript parse diagnostics")
                continue
            if witness["symbolKind"]=="method":
                matching=[x for x in record["methods"] if x["name"]==name and x["className"]==witness["className"]]
            else:
                matching=[x for x in record["declarations"] if x["name"]==name]
            if not matching:
                issues.append(f"{sid}: symbol absent from TypeScript AST")
                continue
            if witness.get("visibility") and not any(x.get("visibility")==witness["visibility"] for x in matching):
                issues.append(f"{sid}: method visibility differs")
        else:
            # Explicit lexical fallback: do not present as AST or signature proof.
            if witness["symbolKind"]=="js-export-function":
                pattern=r"\bexport\s+function\s+"+re.escape(name)+r"\s*\("
            elif witness["symbolKind"]=="method":
                pattern=r"\b"+re.escape(name)+r"\s*\("
            else:
                pattern=(r"\b(?:export\s+)?(?:async\s+)?function\s+"+re.escape(name)+r"\s*\(" + r"|\bexport\s+const\s+"+re.escape(name)+r"\s*=")
            if not re.search(pattern,text):
                issues.append(f"{sid}: symbol not found by lexical witness")
        if witness.get("documentMarker",name) not in doc.read_text():
            issues.append(f"{sid}: symbol not present in declared documentation")
    return issues

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--ast",action="store_true",help="Require TypeScript AST verification; never falls back")
    p.add_argument("--typescript-package-json",help="Package.json beside an installed TypeScript dependency")
    p.add_argument("--json",action="store_true")
    args=p.parse_args()
    issues=validate(ast=args.ast,typescript_package_json=args.typescript_package_json)
    if args.json: print(json.dumps({"mode":"typescript-ast+javascript-lexical" if args.ast else "lexical", "issues":issues},ensure_ascii=False,indent=2))
    else:
        print(f"Source witnesses: {len(issues)} divergence(s) [mode={'TypeScript AST + JavaScript lexical' if args.ast else 'lexical'}]")
        for issue in issues:print("DRIFT:",issue)
    return int(bool(issues))

if __name__=="__main__":
    raise SystemExit(main())
