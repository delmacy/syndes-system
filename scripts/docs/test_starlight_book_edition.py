"""Contract tests for continuous, editorial Starlight module pages."""
import json
import unittest
from pathlib import Path

from enrich_starlight_book import TOPICS
from build_starlight_continuous import complete_heading_blocks, render

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / 'docs'
BOOK = ROOT / 'experiments/book-ab/starlight/src/content/docs'
OUT = DOCS / 'assets/experimentos/livros/b'
AREAS = {
    'produto': '01-produto',
    'plataforma': '02-plataforma',
    'frontend': '03-interfaces',
    'operacao': '04-operacao',
    'qualidade': '05-infra-qualidade',
}
ANCHORS = (
    'estado', 'casos-de-uso', 'historias-de-usuario', 'requisitos',
    'arquitetura', 'contratos', 'apis', 'eventos', 'dados', 'schema',
    'dependencias', 'configuracao', 'interface', 'testes', 'operacao',
    'wbs', 'registro-de-alteracoes',
)


class ContinuousBookTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.units = json.loads((DOCS / 'subprojects/index.json').read_text())['units']

    def test_unique_module_pages_and_anchors(self):
        self.assertEqual(57, len(self.units))
        self.assertEqual(57, len({unit['id'] for unit in self.units}))
        for unit in self.units:
            area = AREAS[unit['front']]
            uid = unit['id'].lower()
            source = BOOK / area / (uid + '.md')
            output = OUT / area / uid / 'index.html'
            self.assertTrue(source.is_file(), source)
            self.assertTrue(output.is_file(), output)
            self.assertFalse((BOOK / area / uid).exists())
            self.assertFalse((OUT / area / uid / 'apis' / 'index.html').exists())
            markdown = source.read_text(encoding='utf-8')
            html = output.read_text(encoding='utf-8')
            for slug in ANCHORS:
                self.assertIn('href="#' + slug + '"', markdown, unit['id'])
                self.assertIn('id="' + slug + '"', html, unit['id'])
            self.assertNotIn('## Documentação de origem integral', markdown)
            self.assertIn('class="syndes-chapter-index"', markdown)
            self.assertEqual(1, markdown.count('class="syndes-edit-note"'), unit['id'])
            self.assertEqual(1, markdown.count('Como propor uma alteração'), unit['id'])
            self.assertEqual(1, html.count('class="syndes-edit-note"'), unit['id'])
            self.assertIn('github.com/delmacy/syndes-system/edit/main/', markdown)
            self.assertNotIn('Propor ajuste nesta seção', markdown)
            for _, _, filename in TOPICS:
                chapter = (ROOT / unit['entry']).parent / 'chapters' / filename
                if chapter.is_file():
                    marker = 'href="https://github.com/delmacy/syndes-system/blob/main/' + chapter.relative_to(ROOT).as_posix() + '"'
                    self.assertIn(marker, markdown)

    def test_technical_source_is_never_truncated(self):
        for unit in self.units:
            path = ROOT / unit['technicalReference']
            if path.is_file():
                original = path.read_text(encoding='utf-8')
                self.assertEqual(
                    original,
                    ''.join(block for _, block in complete_heading_blocks(original)),
                )

    def test_a06_contains_real_contracts_in_article(self):
        text = (BOOK / '02-plataforma/a06.md').read_text(encoding='utf-8')
        for value in (
            'GET /healthz', 'createAccountAccessServer',
            'apply_tenant_account_delegation', 'Grant/revoke idempotente',
            '## APIs e endpoints', '## Schemas e migrations'
        ):
            self.assertIn(value, text)

    def test_generator_is_idempotent(self):
        path = BOOK / '02-plataforma/a06.md'
        original = path.read_bytes()
        render()
        self.assertEqual(original, path.read_bytes())


if __name__ == '__main__':
    unittest.main()
