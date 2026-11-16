"""Offline regression tests for Next.js-root GitHub Pages artifact assembly."""
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from publish_next_root import publish


class PublishNextRootTests(unittest.TestCase):
    def _fixture(self, root):
        legacy = root / "legacy"
        exported = root / "next-out"
        legacy.mkdir()
        exported.mkdir()
        (legacy / "index.html").write_text(
            '<!doctype html><html><head><link href="assets/legacy.css"></head>'
            '<body>Antiga biblioteca MkDocs</body></html>', encoding="utf-8",
        )
        (legacy / "subprojects/P01-crm").mkdir(parents=True)
        (legacy / "subprojects/P01-crm/index.html").write_text(
            "Old deep URL still serves old documentation", encoding="utf-8"
        )
        (legacy / "assets").mkdir(exist_ok=True)
        (legacy / "assets/legacy.css").write_text("body{}", encoding="utf-8")
        for relative in [
            "index.html", "modulos/crm/index.html",
            "modulos/crm/ficha/index.html",
            "modulos/atendimentos/index.html",
        ]:
            dest = exported / relative
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(
                '<html><head><script src="/syndes-system/_next/static/app.js">'
                '</script></head><body>New Next portal '+relative+'</body></html>',
                encoding="utf-8",
            )
        (exported / "_next/static").mkdir(parents=True)
        (exported / "_next/static/app.js").write_text("/* bundled */", encoding="utf-8")
        return legacy, exported

    def test_next_owns_home_and_legacy_routes_survive(self):
        with TemporaryDirectory() as directory:
            legacy, exported = self._fixture(Path(directory))
            result = publish(legacy, exported, "/syndes-system")
            self.assertEqual(result["next_routes"], 4)
            self.assertIn("New Next portal", (legacy / "index.html").read_text())
            self.assertEqual(
                (legacy / "subprojects/P01-crm/index.html").read_text(),
                "Old deep URL still serves old documentation",
            )
            self.assertIn("Antiga biblioteca MkDocs", (legacy / "legado/index.html").read_text())
            self.assertIn('<base href="/syndes-system/">',
                          (legacy / "legado/index.html").read_text())
            self.assertTrue((legacy / ".nojekyll").is_file())
            self.assertTrue((legacy / "_next/static/app.js").is_file())
            redirect = (legacy / "assets/docs-reader/modulos/crm/ficha/index.html").read_text()
            self.assertIn('url=/syndes-system/modulos/crm/ficha/', redirect)
            self.assertIn("noindex", redirect)

    def test_missing_route_is_refused_before_mutating_legacy_index(self):
        with TemporaryDirectory() as directory:
            legacy, exported = self._fixture(Path(directory))
            (exported / "modulos/atendimentos/index.html").unlink()
            with self.assertRaisesRegex(ValueError, "Missing Next.js exported route"):
                publish(legacy, exported, "/syndes-system")
            self.assertIn("Antiga biblioteca MkDocs", (legacy / "index.html").read_text())

    def test_rejects_invalid_pages_base_and_symlinks(self):
        with TemporaryDirectory() as directory:
            legacy, exported = self._fixture(Path(directory))
            with self.assertRaisesRegex(ValueError, "Pages base"):
                publish(legacy, exported, "/syndes-system/../../bad")
            (exported / "unsafe").symlink_to("/tmp", target_is_directory=True)
            with self.assertRaisesRegex(ValueError, "Symlink"):
                publish(legacy, exported, "/syndes-system")


if __name__ == "__main__":
    unittest.main()
