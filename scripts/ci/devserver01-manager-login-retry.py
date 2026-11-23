#!/usr/bin/env python3
"""Classify Manager Keycloak form retry through the live private HTTPS route."""
import base64
from collections import Counter
import hashlib
from html.parser import HTMLParser
from http.cookiejar import CookieJar
import os
import re
import secrets
import subprocess
import sys
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPCookieProcessor, HTTPRedirectHandler, Request, build_opener

PEER = "delmacy-desktoppc.tayra-delta.ts.net"
ISSUER = f"https://{PEER}:9444/realms/syndes"
MANAGER = f"https://{PEER}:9447/"
CLIENT = "syndes-master-admin"


class LoginForm(HTMLParser):
    def __init__(self, body):
        super().__init__()
        self.action = None
        self.fields = set()
        self.feed(body)

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "form" and values.get("id") == "kc-form-login":
            self.action = values.get("action")
        if tag == "input":
            self.fields.add(values.get("name"))


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def read_response(opener, url, payload=None):
    headers = {}
    if payload:
        headers = {
            "Origin": f"https://{PEER}:9444",
            "Content-Type": "application/x-www-form-urlencoded",
        }
    request = Request(url, data=payload, headers=headers)
    try:
        with opener.open(request, timeout=10) as response:
            return response.getcode(), response.read(262144).decode("utf-8", "replace")
    except HTTPError as error:
        return error.code, error.read(262144).decode("utf-8", "replace")


def recent_errors():
    result = subprocess.run(
        ["docker", "logs", "--since", "20m", "--tail", "2500",
         "syndes-security-access-keycloak-1"],
        capture_output=True, text=True, timeout=10,
    )
    if result.returncode:
        return
    counts = Counter()
    for line in (result.stdout + result.stderr).splitlines():
        if 'clientId="' + CLIENT + '"' in line and 'type="LOGIN_ERROR"' in line:
            match = re.search(r'\berror="([a-z_]{1,40})"', line)
            if match:
                counts[match[1]] += 1
    for name, count in sorted(counts.items()):
        print(f"MANAGER_KEYCLOAK_LOGIN_ERROR={name} COUNT={count}")


def main():
    if os.uname().nodename.split(".")[0] != "DevServer01":
        raise RuntimeError("wrong host")
    recent_errors()
    seed = secrets.token_urlsafe(32).encode("ascii")
    challenge = base64.urlsafe_b64encode(hashlib.sha256(seed).digest()).decode().rstrip("=")
    query = urlencode({
        "client_id": CLIENT, "redirect_uri": MANAGER, "response_type": "code",
        "scope": "openid", "state": secrets.token_urlsafe(24),
        "code_challenge_method": "S256", "code_challenge": challenge,
    })
    opener = build_opener(HTTPCookieProcessor(CookieJar()), NoRedirect())
    status, html = read_response(opener, f"{ISSUER}/protocol/openid-connect/auth?{query}")
    form = LoginForm(html)
    print(f"MANAGER_KEYCLOAK_LOGIN_GET_HTTP={status}")
    if status != 200 or not form.action or not {"username", "password"} <= form.fields:
        raise RuntimeError("initial login form not available")
    action = urlsplit(form.action)
    if (
        action.scheme != "https" or action.netloc != PEER + ":9444"
        or action.path != "/realms/syndes/login-actions/authenticate"
        or action.fragment
    ):
        raise RuntimeError("login form action outside the expected realm")
    data = urlencode({
        "username": "ci-nonexistent-" + secrets.token_hex(12),
        "password": secrets.token_urlsafe(24),
    }).encode("ascii")
    status, html = read_response(opener, form.action, data)
    retry = LoginForm(html)
    fields = bool(retry.action and {"username", "password"} <= retry.fields)
    print(f"MANAGER_KEYCLOAK_INVALID_LOGIN_HTTP={status} RETRY_FORM={'present' if fields else 'missing'}")
    if status != 200 or not fields:
        for text, category in (
            ("cookie not found", "cookie_not_found"),
            ("page has expired", "expired"),
            ("try again", "retry_instructions"),
            ("session not active", "session_not_active"),
        ):
            if text in html.lower():
                print("MANAGER_KEYCLOAK_INVALID_LOGIN_PAGE=" + category)
                break
        raise RuntimeError("Keycloak did not return a usable retry form")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Cookie, redirect query and Keycloak response content stay in memory.
        reason = str(error) if type(error) is RuntimeError else type(error).__name__
        print("MANAGER_KEYCLOAK_PROBE_BLOCKED=" + reason, file=sys.stderr)
        raise SystemExit(2) from None
