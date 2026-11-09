#!/usr/bin/env python3
"""One-time, audited first Platform Manager owner bootstrap.

Never derive platform privileges from workspace memberships, email, names or
tenant roles. A human operator must supply + confirm the immutable Keycloak
user UUID. No action without --apply. No values from Keycloak are printed.
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import uuid

REALM = "syndes"
DB = "syndes_control"
POSTGRES = "syndes-postgres-postgres-1"
SUB_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")

def validate_sub(value):
    if not isinstance(value, str) or not SUB_RE.fullmatch(value):
        raise ValueError("Keycloak subject must be a canonical lower-case UUID")
    return value

def sql_for_bootstrap(subject):
    subject = validate_sub(subject)
    return ("""BEGIN;
LOCK TABLE platform_operator_access IN EXCLUSIVE MODE;
DO $bootstrap$
BEGIN
  IF EXISTS (SELECT 1 FROM platform_operator_access) THEN
    RAISE EXCEPTION 'First owner already exists; manual audited governance required';
  END IF;
  INSERT INTO platform_operator_access(principal_id,role,state)
  VALUES ('""" + subject + """','owner','active');
END
$bootstrap$;
COMMIT;
""")

def db_command(*extra):
    return ["docker", "exec", "-i", "-u", "postgres", POSTGRES, "psql",
            "-w", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", DB, *extra]

def db_empty():
    result = subprocess.run(db_command("-tAc", "SELECT count(*) FROM platform_operator_access"),
                            check=True, text=True, capture_output=True, timeout=12)
    return result.stdout.strip() == "0"

def keycloak_active(subject, port, cfg):
    password = cfg.get("bootstrap-admin-password")
    username = cfg.get("bootstrap-admin-username")
    if not username or not password:
        raise RuntimeError("Missing Keycloak bootstrap admin mount")
    base = f"http://127.0.0.1:{port}"
    form = urlencode({"grant_type":"password","client_id":"admin-cli",
                      "username":username,"password":password}).encode()
    with urlopen(Request(base+"/realms/master/protocol/openid-connect/token",
                         data=form,headers={"Content-Type":"application/x-www-form-urlencoded"}),timeout=8) as response:
        token = json.load(response)["access_token"]
    req = Request(base+f"/admin/realms/{REALM}/users/"+subject,
                  headers={"Authorization":"Bearer "+token})
    with urlopen(req,timeout=8) as response:
        user = json.load(response)
    return user.get("id") == subject and user.get("enabled") is True

def audit_update(path, document):
    temp=path.with_name("."+path.name+".new")
    fd = os.open(temp, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        with os.fdopen(fd,"w",encoding="utf-8") as file:
            json.dump(document,file)
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())
        os.replace(temp,path)
    finally:
        if temp.exists():
            temp.unlink()

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--principal-id",required=True)
    parser.add_argument("--confirm-principal-id",required=True)
    parser.add_argument("--operator",required=True,help="Explicit accountable operator, not a Keycloak login")
    parser.add_argument("--audit-dir",required=True,help="Private local audit directory outside source control")
    parser.add_argument("--keycloak-port",type=int,default=18080)
    parser.add_argument("--apply",action="store_true")
    args=parser.parse_args()
    subject=validate_sub(args.principal_id)
    if args.confirm_principal_id != subject:
        raise RuntimeError("Principal confirmation does not match")
    if not args.operator.strip() or len(args.operator)>80 or "\n" in args.operator:
        raise RuntimeError("An accountable operator must be identified")
    if not (1 <= args.keycloak_port <= 65535):
        raise RuntimeError("Invalid Keycloak port")
    directory=Path(args.audit_dir)
    if not directory.is_dir() or directory.is_symlink() or (directory.stat().st_mode & 0o077):
        raise RuntimeError("Audit directory must already exist with private permissions")
    cfg={}
    for line in sys.stdin:
        line=line.strip()
        if line and not line.startswith("#") and "=" in line:
            key,value=line.split("=",1)
            cfg[key.strip()]=value.strip().strip('"')
    try:
        active=keycloak_active(subject,args.keycloak_port,cfg)
    except (HTTPError, URLError):
        raise RuntimeError("Keycloak user verification unavailable") from None
    if not active:
        raise RuntimeError("Immutable Keycloak subject is missing or disabled")
    if not db_empty():
        raise RuntimeError("Existing operator access; first-owner bootstrap forbidden")
    if not args.apply:
        print("FIRST OWNER PREFLIGHT PASS: subject verified, control table empty; no changes made")
        return
    now=datetime.now(timezone.utc).isoformat()
    record={"operation":"bootstrap-first-platform-owner","operator":args.operator.strip(),
            "host_uid":os.getuid() if hasattr(os,"getuid") else None,
            "keycloak_sub":subject,"started_at_utc":now,"status":"pending"}
    audit=directory / ("first-owner-"+datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")+"-"+uuid.uuid4().hex[:12]+".json")
    fd=os.open(audit,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    with os.fdopen(fd,"w",encoding="utf-8") as file:
        json.dump(record,file)
        file.write("\n")
        file.flush()
        os.fsync(file.fileno())
    completed=subprocess.run(db_command("-f","-"),input=sql_for_bootstrap(subject),
                             check=False,text=True,capture_output=True,timeout=15)
    if completed.returncode != 0:
        record["status"]="requires-manual-reconciliation"
        audit_update(audit,record)
        raise RuntimeError("Control DB denied owner bootstrap; reconcile private audit record")
    record["status"]="committed"
    record["committed_at_utc"]=datetime.now(timezone.utc).isoformat()
    audit_update(audit,record)
    print("FIRST OWNER BOOTSTRAP COMMITTED with private audit record; no user data printed")

if __name__=="__main__":
    try:
        main()
    except Exception as e:
        print("Owner bootstrap denied: "+str(e),file=sys.stderr)
        sys.exit(1)
