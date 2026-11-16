#!/usr/bin/env python3
"""Promote the Next.js static export to GitHub Pages root without losing legacy docs.

MkDocs first builds all existing public documentation at its historical URLs.
Next.js then replaces only the landing page and its own routes/assets.
A preserved legacy index remains at /legado/, while previous Next deep links
under /assets/docs-reader/ redirect to the new canonical Next paths.
"""
from __future__ import annotations

import argparse
from html import escape
from pathlib import Path
import re
import shutil
from urllib.parse import quote


def _real_directory(path: Path, label: str) -> Path:
    if path.is_symlink() or not path.is_dir():
        raise ValueError(f"{label} must be a real directory: {path}")
    return path.resolve()


def publish(legacy_site: Path, next_export: Path, pages_base: str) -> dict[str, int]:
    """Merge bounded, local static outputs; never download or run arbitrary assets."""
    legacy_site = _real_directory(legacy_site, "Legacy MkDocs site")
    next_export = _real_directory(next_export, "Next.js export")
    if not re.fullmatch(r"/[a-zA-Z0-9_-]+", pages_base):
        raise ValueError("Pages base must be exactly a safe repository subpath")

    for relative in (
        "index.html",
        "modulos/crm/index.html",
        "modulos/crm/ficha/index.html",
        "modulos/atendimentos/index.html",
    ):
        if not (next_export / relative).is_file():
            raise ValueError(f"Missing Next.js exported route: {relative}")

    legacy_index = legacy_site / "index.html"
    if not legacy_index.is_file():
        raise ValueError("MkDocs index.html not found")
    old_html = legacy_index.read_text(encoding="utf-8")
    if "<head" not in old_html.lower():
        raise ValueError("MkDocs home must contain a head section")

    # The historical MkDocs homepage is accessible at /legado/. Its relative
    # navigation still points to the original, preserved technical routes.
    legacy_landing = legacy_site / "legado" / "index.html"
    legacy_landing.parent.mkdir(parents=True, exist_ok=True)
    legacy_landing.write_text(
        re.sub(
            r"(?i)<head([^>]*)>",
            lambda m: m.group(0) + f'\n<base href="{pages_base}/">\n',
            old_html,
            count=1,
        ),
        encoding="utf-8",
    )

    # Reserve the old Next route namespace only for tiny redirects; do not
    # leave obsolete copies of Next bundles mixed with the active application.
    redirect_root = legacy_site / "assets" / "docs-reader"
    if redirect_root.is_symlink():
        raise ValueError("Symlink in historical Next redirect path")
    if redirect_root.exists():
        shutil.rmtree(redirect_root)

    # MkDocs technical pages (/subprojects, /blueprint, /standards, etc.) are
    # intentionally kept at their existing public URLs. Next owns '/' and
    # '/modulos/**', and its _next bundles use the repository basePath.
    for source in next_export.rglob("*"):
        if source.is_symlink():
            raise ValueError(f"Symlink in Next.js export: {source}")
    shutil.copytree(next_export, legacy_site, dirs_exist_ok=True)

    # GitHub Pages should not apply Jekyll processing to Next's "_next" assets.
    (legacy_site / ".nojekyll").touch(exist_ok=True)

    routes = sorted(next_export.rglob("index.html"))
    for source in routes:
        relative = source.relative_to(next_export)
        route_parts = relative.parent.parts
        public_target = pages_base + "/" + "/".join(quote(s) for s in route_parts)
        if not public_target.endswith("/"):
            public_target += "/"
        target = redirect_root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        safe_url = escape(public_target, quote=True)
        target.write_text(
            '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
            '<meta name="robots" content="noindex">'
            f'<meta http-equiv="refresh" content="0;url={safe_url}">'
            f'<link rel="canonical" href="{safe_url}">'
            '<title>Biblioteca Syndes — endereço atualizado</title>'
            '</head><body><p>A Biblioteca mudou de endereço. '
            f'<a href="{safe_url}">Abrir a nova página</a>.</p></body></html>\n',
            encoding="utf-8",
        )

    # Validate published entrypoint, asset prefix and preserved legacy routes.
    live_index = (legacy_site / "index.html").read_text(encoding="utf-8")
    if live_index != (next_export / "index.html").read_text(encoding="utf-8"):
        raise AssertionError("Primary landing page is not the Next.js home")
    if f"{pages_base}/_next/" not in live_index:
        raise AssertionError("Next.js assets are missing the Pages basePath")
    if not (legacy_site / "legado/index.html").is_file():
        raise AssertionError("Legacy index not preserved")
    if not (legacy_site / "assets/docs-reader/modulos/crm/index.html").is_file():
        raise AssertionError("Old Next deep-link redirect not generated")
    return {"next_routes": len(routes), "legacy_index": 1, "redirects": len(routes)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--legacy-site", type=Path, default=Path(".docs-site/site"))
    parser.add_argument("--next-export", type=Path, default=Path("apps/docs-reader/out"))
    parser.add_argument("--pages-base", default="/syndes-system")
    args = parser.parse_args()
    print("Published Next.js root with legacy documentation:", publish(
        args.legacy_site, args.next_export, args.pages_base
    ))


if __name__ == "__main__":
    main()
