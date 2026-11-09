#!/usr/bin/env python3
"""Fail-closed, read-only check for the dedicated Platform Manager Tailscale Serve route.

Checks the structured Serve configuration; a port number alone is not
evidence of a working or owned application. Never prints Tailnet hostnames.
"""
import argparse
import json
import sys


def check(config, mode, port=9446, target="http://127.0.0.1:18085"):
    if not isinstance(config, dict):
        return False, "Malformed Tailscale Serve configuration"
    tcp, web = config.get("TCP", {}), config.get("Web", {})
    if not isinstance(tcp, dict) or not isinstance(web, dict):
        return False, "Malformed Tailscale Serve mappings"
    port_key = str(port)
    matching = [(hostname, value) for hostname, value in web.items()
                if isinstance(hostname, str) and hostname.endswith(":" + port_key)]
    port_taken = port_key in tcp or bool(matching)
    if mode == "free":
        return (not port_taken,
                "Dedicated HTTPS port is unallocated" if not port_taken
                else "Dedicated HTTPS port is already configured; never replace another route")
    if not port_taken or len(matching) != 1:
        return False, "Dedicated HTTPS port has no unique route"
    https = tcp.get(port_key)
    if not isinstance(https, dict) or https.get("HTTPS") is not True:
        return False, "Dedicated port must use Tailscale HTTPS"
    hostname, entry = matching[0]
    if not isinstance(entry, dict):
        return False, "Malformed HTTPS route"
    handlers = entry.get("Handlers")
    if not isinstance(handlers, dict) or set(handlers) != {"/"}:
        return False, "Unexpected paths on the dedicated HTTPS route"
    root = handlers["/"]
    if not isinstance(root, dict) or root.get("Proxy") != target or set(root) != {"Proxy"}:
        return False, "Dedicated HTTPS route points to the wrong local service"
    funnel = config.get("AllowFunnel", {})
    if not isinstance(funnel, dict) or funnel.get(hostname) is True:
        return False, "Public Funnel is forbidden for the Manager"
    return True, "Private HTTPS route points exactly to the Manager frontend"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", required=True, choices=("free", "active"))
    parser.add_argument("--port", type=int, default=9446)
    parser.add_argument("--target", default="http://127.0.0.1:18085")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535 or args.target != "http://127.0.0.1:18085":
        print("BLOCKED: Unapproved Manager route target", file=sys.stderr)
        return 2
    try:
        config = json.load(sys.stdin)
    except (ValueError, OSError):
        print("BLOCKED: Unable to read Tailscale Serve JSON", file=sys.stderr)
        return 2
    ok, message = check(config, args.mode, args.port, args.target)
    print(("PASS: " if ok else "BLOCKED: ") + message)
    return 0 if ok else 2


if __name__ == "__main__":
    raise SystemExit(main())
