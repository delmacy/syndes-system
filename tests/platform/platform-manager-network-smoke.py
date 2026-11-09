#!/usr/bin/env python3
"""Validate proposed network topology and Docker bridge isolation on disposable CI."""
import json
import os
import pathlib
import subprocess
import tempfile
import time
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[2]

def run(*args, env=None, check=True, timeout=80):
    return subprocess.run(args, cwd=ROOT, env=env, text=True, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, check=check, timeout=timeout)

with tempfile.TemporaryDirectory(prefix="syndes-manager-net-ci-") as temp:
    tmp = pathlib.Path(temp)
    (tmp / "master.env").write_text(
        "MASTER_KEYCLOAK_ISSUER=https://id.example.test/realms/syndes\n"
        "MASTER_KEYCLOAK_AUDIENCE=syndes-master-api\n"
        "MASTER_KEYCLOAK_CLIENT_ID=syndes-master-admin\n"
        "MASTER_KEYCLOAK_JWKS_URL=http://keycloak:8080/realms/syndes/protocol/openid-connect/certs\n"
        "MASTER_PUBLIC_ORIGIN=https://master.example.test\n"
        "MASTER_CONTROL_DB_URL_FILE=/run/secrets/master_db_url\n"
    )
    (tmp / "master.json").write_text('{"issuer":"https://id.example.test/realms/syndes","clientId":"syndes-master-admin"}\n')
    (tmp / "db-placeholder").write_text("CI-only placeholder, never a credential\n")
    env = dict(os.environ, MASTER_API_ENV_FILE=str(tmp / "master.env"),
               MASTER_RUNTIME_JSON=str(tmp / "master.json"),
               MASTER_DB_URL_FILE=str(tmp / "db-placeholder"))

    def compose(path, *, ci=False):
        args = ["docker", "compose"]
        if ci:
            args += ["--env-file", "infra/.env.ci"]
        args += ["-f", path, "config", "--format", "json"]
        return json.loads(run(*args, env=env).stdout)

    manager = compose("infra/master-admin/compose.yaml")
    pg = compose("infra/postgres/compose.yaml", ci=True)
    security = compose("infra/security-access/compose.yaml", ci=True)
    core = compose("apps/core-host/compose.yaml", ci=True)
    def attached(doc, service):
        return set(doc["services"][service]["networks"])
    assert attached(manager, "master-api") == {"master-private", "syndes-master-data", "syndes-master-identity"}
    assert attached(manager, "master-web") == {"master-private"}
    assert "syndes-master-data" in attached(pg, "postgres")
    assert "syndes-master-identity" in attached(security, "keycloak")
    assert {"syndes-master-data", "syndes-master-identity"}.isdisjoint(attached(core, "core-host"))
    assert {"syndes-master-data", "syndes-master-identity"}.isdisjoint(attached(security, "openfga"))
    assert manager["networks"]["master-private"]["internal"] is True
    for name in ("syndes-master-data", "syndes-master-identity"):
        assert manager["networks"][name]["external"] is True
    assert not manager["services"]["master-api"].get("ports"), "API may not publish host ports"
    ports = manager["services"]["master-web"]["ports"]
    assert len(ports) == 1 and ports[0]["host_ip"] == "127.0.0.1"
    assert set(manager["services"]) == {"master-api", "master-web"}
    print("Compose separation contract: PASS")

# Prove Docker's bridge policy with independent throwaway networks and test containers.
# This validates the engine on the CI runner, not the final production firewall.
prefix = "ci-pm-net-" + uuid.uuid4().hex[:12]
master_net, identity_net, core_net = (prefix + suffix for suffix in ("-data", "-identity", "-core"))
target = prefix + "-tenant-core"
networks = []
try:
    for net in (master_net, identity_net, core_net):
        run("docker", "network", "create", "--internal", net)
        networks.append(net)
    run("docker", "pull", "nginx:1.29-alpine", timeout=120)
    run("docker", "pull", "curlimages/curl:8.12.1", timeout=120)
    run("docker", "run", "-d", "--rm", "--name", target, "--network", core_net,
        "nginx:1.29-alpine", timeout=120)
    ip = run("docker", "inspect", "-f", "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}", target).stdout.strip()
    assert ip and ip.count(".") == 3, "No target IP"

    def reach(net, *, timeout=18):
        return run("docker", "run", "--rm", "--network", net, "curlimages/curl:8.12.1",
                   "--silent", "--fail", "--max-time", "2", "http://" + ip + "/",
                   check=False, timeout=timeout).returncode == 0

    for _ in range(12):
        if reach(core_net):
            break
        time.sleep(0.5)
    else:
        raise AssertionError("Positive network test failed; nginx fixture not ready")

    for isolated in (master_net, identity_net):
        assert not reach(isolated), "Admin-only network reached the tenant Core IP"
    print("Docker network separation: PASS (positive core route and denied admin-to-core IP routes)")
finally:
    run("docker", "rm", "-f", target, check=False, timeout=25)
    for net in reversed(networks):
        run("docker", "network", "rm", net, check=False, timeout=25)
