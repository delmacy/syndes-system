#!/usr/bin/env python3
"""Review a module agent's changed paths against canonical owner boundaries.

Advisory enforcement: needs independent CI/worktree permissions for a security boundary.
"""
import argparse
import json
import subprocess
from pathlib import Path, PurePosixPath

ROOT=Path(__file__).resolve().parents[2]
UNITS={u["id"]:u for u in json.loads((ROOT/"docs/subprojects/index.json").read_text())["units"]}

def allowed_roots(unit):
    source=PurePosixPath(unit["source"])
    doc=PurePosixPath(unit["entry"]).parent
    return source,doc

def in_owned_path(path,source):
    return path==source or source in path.parents

def verify_changed_paths(unit, paths):
    source,docs=allowed_roots(unit)
    violations=[]
    for item in paths:
        norm=item.replace("\\","/")
        path=PurePosixPath(norm)
        if path.is_absolute() or ".." in path.parts or norm.startswith("./"):
            violations.append(norm)
            continue
        if not (in_owned_path(path,source) or in_owned_path(path,docs)):
            violations.append(norm)
    # Most-specific owner wins. Broad/shared source roots cannot bypass a narrower owner.
    for item in paths:
        path=PurePosixPath(item.replace("\\","/"))
        if not in_owned_path(path,source):continue
        for other in UNITS.values():
            if other["id"]==unit["id"]:continue
            if other.get("documentationParent")==unit["id"]:continue
            other_source=PurePosixPath(other["source"])
            if (other_source==source or
                    (in_owned_path(other_source,source) and in_owned_path(path,other_source))):
                if item not in violations:violations.append(item)
                break
    return violations

def get_changes(base):
    # diff supports staged and unstaged; untracked work is included.
    cmd=["git","diff","--name-only","--no-ext-diff","--diff-filter=ACDMRTUXB",base,"--"]
    diff=subprocess.run(cmd,cwd=ROOT,text=True,capture_output=True,check=True)
    untracked=subprocess.run(["git","ls-files","--others","--exclude-standard"],
                             cwd=ROOT,text=True,capture_output=True,check=True)
    return sorted(set(diff.stdout.splitlines()+untracked.stdout.splitlines()))

def main():
    parser=argparse.ArgumentParser(description="Check agent change scope by canonical module ID")
    parser.add_argument("--module",required=True,help="Canonical module ID, e.g. P03")
    parser.add_argument("--base",default="origin/main",help="Git comparison ref; default: origin/main")
    args=parser.parse_args()
    unit=UNITS.get(args.module)
    if not unit: parser.error("Unknown module ID; refusing broad access")
    if unit.get("documentationParent"):
        parser.error("Internal component: use its canonical documentation parent/owner")
    paths=get_changes(args.base)
    violations=verify_changed_paths(unit,paths)
    print("Module:",args.module,"· source:",unit["source"],
          "· documentation:",str(PurePosixPath(unit["entry"]).parent))
    print("Changed paths:",len(paths),"· out of scope:",len(violations))
    for path in violations:print("DENIED:",path)
    if violations:
        print("FAILED. Do not commit/merge; resolve via explicit cross-owner decision.")
        return 2
    print("PASS: no changed paths outside declared module+documentation roots.")
    print("NOTE: path check is advisory; enforce with separate workspace permissions or CI gate.")
    return 0

if __name__=="__main__":raise SystemExit(main())
