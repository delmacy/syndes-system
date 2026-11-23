#!/usr/bin/env python3
"""Move the shared gateway PostgreSQL off volatile bootstrap files."""
import copy
import http.client
import json
import os
from pathlib import Path
import re
import socket
import stat
import tempfile
import time
from urllib.parse import urlencode

ARCHIVE = Path("/home/delmacy/.local/share/syndes-operational-secrets")
PERSISTENT = ARCHIVE.with_name("syndes-whatsapp-postgres-files")
VOLATILE = Path("/run/syndes/runtime")
NAMES = ("pg_admin_password", "pg_keycloak_password", "pg_openfga_password", "pg_core_password")
PG = "syndes-postgres-postgres-1"
PG_VOLUME = "syndes-postgres_postgres_data"


def verify(condition, stage):
    if not condition:
        raise RuntimeError(stage)


def source_file(root, name, mode):
    path = root / name
    status = path.lstat()
    verify(stat.S_ISREG(status.st_mode) and status.st_uid == os.getuid()
           and stat.S_IMODE(status.st_mode) == mode and 0 < status.st_size < 1024, "postgres_file_permissions")
    return path.read_text()


def protected_directory(root):
    status = root.lstat()
    verify(root.resolve() == root and stat.S_ISDIR(status.st_mode) and status.st_uid == os.getuid()
           and stat.S_IMODE(status.st_mode) == 0o700, "postgres_directory_permissions")


def sync_directory(path):
    fd = os.open(path, os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def publish(pg, docker):
    protected_directory(ARCHIVE)
    values = {}
    for name in NAMES:
        content = source_file(ARCHIVE, name, 0o600)
        mounted = docker("exec", "-u", "0", pg["Id"], "cat", "/run/secrets/" + name)
        verify(re.fullmatch(r"[A-Za-z0-9_-]{20,256}", mounted) and mounted == content.strip(),
               "postgres_archive_live_mismatch")
        values[name] = content
    if os.path.lexists(PERSISTENT):
        protected_directory(PERSISTENT)
        for name, value in values.items():
            verify(source_file(PERSISTENT, name, 0o444) == value, "postgres_persistent_file_drift")
        return
    with tempfile.TemporaryDirectory(prefix=".postgres-files-", dir=PERSISTENT.parent) as scratch:
        root = Path(scratch) / "files"
        root.mkdir(mode=0o700)
        for name, value in values.items():
            path = root / name
            with path.open("x") as stream:
                stream.write(value)
                os.fchmod(stream.fileno(), 0o444)
                stream.flush()
                os.fsync(stream.fileno())
        sync_directory(root)
        root.rename(PERSISTENT)
        sync_directory(PERSISTENT.parent)


def mounted_sources(pg):
    mounts = {entry["Destination"]: entry for entry in pg["Mounts"]}
    data = mounts["/var/lib/postgresql/data"]
    verify(data["Type"] == "volume" and data["Name"] == PG_VOLUME and data["RW"], "postgres_volume_identity")
    result = {}
    for name in NAMES:
        destination = "/run/secrets/" + name
        mount = mounts[destination]
        verify(mount["Type"] == "bind" and not mount["RW"], "postgres_mount_mode")
        result[destination] = mount["Source"]
    return result


def with_persistent_mounts(pg):
    sources = mounted_sources(pg)
    verify(all(path == str(VOLATILE / Path(target).name) for target, path in sources.items()),
           "postgres_old_mount_scope")
    old_config = copy.deepcopy(pg["Config"])
    old_host = copy.deepcopy(pg["HostConfig"])
    verify(not old_host.get("VolumesFrom") and not old_host.get("PortBindings"), "postgres_host_scope")
    target_paths = {target: str(PERSISTENT / Path(target).name) for target in sources}
    changed = set()
    binds = []
    for bind in old_host.get("Binds") or []:
        source, target, *mode = bind.split(":")
        if target in target_paths:
            verify(source == sources[target] and "ro" in mode, "postgres_bind_contract")
            source = target_paths[target]
            changed.add(target)
        binds.append(":".join((source, target, *mode)))
    old_host["Binds"] = binds
    for mount in old_host.get("Mounts") or []:
        target = mount["Target"]
        if target in target_paths:
            verify(mount["ReadOnly"] and mount["Source"] == sources[target], "postgres_bind_contract")
            mount["Source"] = target_paths[target]
            changed.add(target)
    verify(changed == set(sources), "postgres_incomplete_mount_set")
    networks = pg["NetworkSettings"]["Networks"]
    verify(set(networks) == {"syndes-data", "syndes-master-data"}, "postgres_network_scope")
    endpoints = {name: {key: value for key, value in data.items()
                        if key in ("Aliases", "IPAMConfig", "DriverOpts", "GwPriority") and value is not None}
                 for name, data in networks.items()}
    old_config["Image"] = pg["Image"]
    return dict(old_config, HostConfig=old_host, NetworkingConfig={"EndpointsConfig": endpoints})


class DockerEngine(http.client.HTTPConnection):
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect("/var/run/docker.sock")


def create(name, payload):
    engine = DockerEngine("localhost", timeout=30)
    try:
        engine.request("POST", "/containers/create?" + urlencode({"name": name}),
                       body=json.dumps(payload), headers={"Content-Type": "application/json"})
        response = engine.getresponse()
        body = response.read()
        verify(response.status == 201, "postgres_container_create_http_" + str(response.status))
        identity = json.loads(body)["Id"]
    finally:
        engine.close()
    verify(re.fullmatch(r"[a-f0-9]{64}", identity), "postgres_replacement_identity")
    return identity


def ensure_persistent(pg, docker, verify_ready):
    def inspect(target):
        return json.loads(docker("container", "inspect", target))[0]

    publish(pg, docker)
    if all(path == str(PERSISTENT / Path(target).name) for target, path in mounted_sources(pg).items()):
        verify_ready(pg)
        return pg
    replacement = create(PG + "-file-mounts-candidate", with_persistent_mounts(pg))
    previous = pg["Id"]
    parked = False
    try:
        docker("stop", "--time", "20", previous)
        docker("rename", previous, PG + "-volatile-fallback")
        parked = True
        docker("rename", replacement, PG)
        docker("start", replacement)
        current = inspect(replacement)
        verify(all(path == str(PERSISTENT / Path(target).name)
                   for target, path in mounted_sources(current).items()), "postgres_persistent_bind_verification")
        for _ in range(20):
            try:
                verify_ready(current)
                break
            except RuntimeError:
                time.sleep(2)
        else:
            raise RuntimeError("postgres_replacement_readiness")
    except Exception:
        docker("rm", "-f", replacement)
        if parked:
            docker("rename", previous, PG)
        if not inspect(previous)["State"]["Running"]:
            docker("start", previous)
        raise
    docker("rm", previous)
    print("SYNDES_CLEANUP_GATEWAY_POSTGRES_PERSISTENT_MOUNTS_PASS", flush=True)
    return current
