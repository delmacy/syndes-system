#!/usr/bin/env python3
"""Validate audit status against the catalog and 57-row plan without fixed counts.

Only reads repository files by default. --sync-summary edits the single summary
sentence, never STATUS, source code or runtime infrastructure.
"""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "docs/subprojects/index.json"
PLAN = ROOT / "docs/blueprint/PLANO-ATUALIZACAO-MODULOS.md"
PARTIAL_MARKER = "AUDITORIA TÉCNICA PARCIAL"
SUMMARY = re.compile(r"\*\*\d+ STATUS com auditoria técnica parcial registrada:\*\*.*?\*\*\d+ STATUS\*\*[^\n]*", re.I)
ROW = re.compile(r"^\|\s*(\d+)\s*\|\s*\[([A-Z]\d{2})\s+—.*?\|\s*([^|]+)\s*\|\s*$", re.M)

def load_units(root=ROOT):
    data = json.loads((root / "docs/subprojects/index.json").read_text(encoding="utf8"))
    units = data["units"]
    ids = [unit["id"] for unit in units]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate module IDs in catalog")
    return units

def audit_snapshot(root=ROOT):
    units = load_units(root)
    audited = []
    for unit in units:
        text = (root / unit["status"]).read_text(encoding="utf8")
        if PARTIAL_MARKER in text:
            audited.append(unit["id"])
    return {"total": len(units), "audited": len(audited),
            "baseline": len(units)-len(audited), "ids": sorted(audited)}

def validate(root=ROOT):
    snap = audit_snapshot(root)
    units = load_units(root)
    plan = (root / "docs/blueprint/PLANO-ATUALIZACAO-MODULOS.md").read_text(encoding="utf8")
    issues = []
    rows = ROW.findall(plan)
    ids = [uid for _,uid,_ in rows]
    expected = {unit["id"] for unit in units}
    if len(rows) != len(units) or set(ids) != expected or len(ids) != len(set(ids)):
        issues.append("Plan row IDs/order do not match documented catalog units")
    numbers = [int(n) for n,_,_ in rows]
    if numbers != list(range(1,len(units)+1)):
        issues.append("Plan order numbers must be sequential")
    summary = SUMMARY.search(plan)
    if summary is None:
        issues.append("Audit summary missing")
    else:
        sentence = summary.group()
        observed = re.match(r"\*\*(\d+) STATUS com auditoria técnica parcial registrada:\*\*",sentence)
        outstanding = re.search(r"\*\*(\d+) STATUS\*\*",sentence)
        if not observed or int(observed.group(1)) != snap["audited"]:
            issues.append(f"Audit count mismatch: status files={snap['audited']}")
        if not outstanding or int(outstanding.group(1)) != snap["baseline"]:
            issues.append(f"Baseline count mismatch: status files={snap['baseline']}")
        # IDs in prose must correspond to audited STATUS exactly: no ghost/missing partial audit.
        prose = sentence.split(":",1)[1].split("**"+str(snap["baseline"])+" STATUS**",1)[0]
        listed = set(re.findall(r"\b[A-Z]\d{2}\b",prose))
        if listed != set(snap["ids"]):
            issues.append(f"Audited ID mismatch: missing={sorted(set(snap['ids'])-listed)}, "
                          f"extra={sorted(listed-set(snap['ids']))}")
    audited = set(snap["ids"])
    for _, uid, state in rows:
        is_partial = bool(re.search(r"\bParcial\b",state,re.I))
        is_baseline = bool(re.search(r"Baseline; não auditado",state,re.I))
        if uid in audited and is_baseline:
            issues.append(f"{uid}: partial status declared baseline in plan")
        if uid not in audited and is_partial:
            issues.append(f"{uid}: plan claims partial audit but STATUS has no evidence marker")
    return snap, issues

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json",action="store_true")
    parser.add_argument("--check",action="store_true",help="Validate audit counts and plan alignment")
    args=parser.parse_args()
    snap, issues = validate()
    if args.json:
        print(json.dumps({"snapshot":snap,"issues":issues},indent=2,ensure_ascii=False))
    else:
        print(f"Audit: {snap['audited']} partial / {snap['total']} units; "
              f"{snap['baseline']} baseline; discrepancies: {len(issues)}")
        for issue in issues: print("DRIFT:",issue)
    return int(bool(issues))

if __name__ == "__main__":
    raise SystemExit(main())
