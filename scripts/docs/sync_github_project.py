#!/usr/bin/env python3
"""Idempotent GitHub Projects V2 issue importer. Explicit token and project URL required.

This script never fabricates issues, fields, deadlines or status. Uses the official
GitHub REST user/org Project items API; only matching labeled repository issues.
"""
import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

API="https://api.github.com"
PROJECT=re.compile(r"^https://github\.com/(users|orgs)/([A-Za-z0-9-]+)/projects/([1-9][0-9]*)/?$")
def parse_project(url):
    m=PROJECT.fullmatch(url.strip())
    if not m:
        raise ValueError("Use exact URL https://github.com/users/OWNER/projects/NUMBER or orgs/OWNER/projects/NUMBER")
    kind,owner,number=m.groups()
    return kind,owner,int(number)
def api_request(token,method,path,payload=None,with_link=False):
    headers={"Authorization":"Bearer "+token,"Accept":"application/vnd.github+json",
             "X-GitHub-Api-Version":"2026-03-10","User-Agent":"syndes-docs-project-sync"}
    data=json.dumps(payload).encode("utf8") if payload is not None else None
    if data is not None:headers["Content-Type"]="application/json"
    req=urllib.request.Request(API+path,headers=headers,data=data,method=method)
    with urllib.request.urlopen(req,timeout=30) as resp:
        raw=resp.read()
        decoded=json.loads(raw) if raw else {}
        return (decoded,resp.headers.get("Link","")) if with_link else decoded

def next_page_path(link):
    """GitHub Projects V2 uses cursor pagination; classic Issue APIs use page links."""
    for segment in link.split(","):
        if 'rel="next"' not in segment:continue
        m=re.search(r"<([^>]+)>",segment)
        if not m:return None
        target=urllib.parse.urlsplit(m.group(1))
        if target.scheme!="https" or target.netloc!="api.github.com":
            raise ValueError("Untrusted API pagination host")
        return target.path+("?" + target.query if target.query else "")
    return None

def collect_pages(token,path):
    items=[]
    next_path=path+("&" if "?" in path else "?")+"per_page=100"
    visited=set()
    for _ in range(100):
        if next_path in visited:raise RuntimeError("Cyclic pagination detected")
        visited.add(next_path)
        data,link=api_request(token,"GET",next_path,with_link=True)
        part=data if isinstance(data,list) else data.get("items",[])
        if not isinstance(part,list):raise ValueError("Unexpected API pagination response")
        items.extend(part)
        next_path=next_page_path(link)
        if not next_path:return items
    raise RuntimeError("API returned more than 100 pages; stopping rather than truncating")

def issue_key(item):
    """Compare issue repository + number; numbers alone collide across repositories."""
    content=item.get("content") if isinstance(item,dict) else None
    if not isinstance(content,dict):
        content=item if isinstance(item,dict) else {}
    if content.get("pull_request") or content.get("type") in ("PullRequest","PULL_REQUEST"):
        return None
    number=content.get("number")
    if not isinstance(number,int):return None
    repo_url=content.get("repository_url","")
    if not repo_url:
        url=content.get("url","") or content.get("html_url","")
        m=re.search(r"/repos/([^/]+/[^/]+)/issues/[0-9]+(?:$|[?#])",str(url))
        if not m:m=re.search(r"github[.]com/([^/]+/[^/]+)/issues/[0-9]+(?:$|[?#])",str(url))
        repo_full=m.group(1) if m else None
    else:
        m=re.search(r"/repos/([^/]+/[^/]+)(?:$|[?#])",str(repo_url))
        repo_full=m.group(1) if m else None
    return (repo_full.casefold(),number) if repo_full else None

def sync(repo,url,token,dry_run=False):
    kind,owner,number=parse_project(url)
    project_path=f"/{'users' if kind=='users' else 'orgs'}/{owner}/projectsV2/{number}/items"
    issue_path="/repos/"+repo+"/issues?state=all&labels=syndes-docs-workpackage"
    issues=[x for x in collect_pages(token,issue_path) if isinstance(x,dict) and "pull_request" not in x]
    issues.sort(key=lambda x:x["number"])
    existing=collect_pages(token,project_path)
    numbers={issue_key(item) for item in existing}
    added=0
    for issue in issues:
        n=issue["number"]
        if (repo.casefold(),n) in numbers:
            print(f"SKIP already in project: #{n}");continue
        print(f"{'WOULD_ADD' if dry_run else 'ADD'} #{n}: {issue['title']}")
        if not dry_run:
            repo_owner,repo_name=repo.split("/")
            payload={"type":"Issue","owner":repo_owner,"repo":repo_name,"number":n}
            try:api_request(token,"POST",project_path,payload)
            except urllib.error.HTTPError as exc:
                if exc.code==422:
                    print(f"SKIP duplicate item #{n} (API 422)")
                    continue
                raise
        added+=1
    print(f"Project {url}: source issues={len(issues)} existing items={len(existing)} {'would_add' if dry_run else 'added'}={added}")
    return added
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--repo",default="delmacy/syndes-system")
    p.add_argument("--project-url",default=os.getenv("SYNDES_PROJECT_URL",""))
    p.add_argument("--dry-run",action="store_true")
    args=p.parse_args()
    token=os.getenv("SYNDES_PROJECTS_PAT","")
    if not token or not args.project_url:
        p.error("SYNDES_PROJECT_URL and SYNDES_PROJECTS_PAT must be configured. A GitHub connector or GITHUB_TOKEN alone cannot write user-owned Projects.")
    try:sync(args.repo,args.project_url,token,args.dry_run)
    except (ValueError,urllib.error.HTTPError,urllib.error.URLError) as exc:
        print(f"Project synchronization failed safely: {exc}",file=sys.stderr)
        raise SystemExit(1)
if __name__=="__main__":main()
