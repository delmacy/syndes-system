"""Starlight book: 57 full Markdown chapters, one page per module."""
import json
import unittest
from pathlib import Path

from enrich_starlight_book import TOPICS
from build_starlight_continuous import complete_heading_blocks, render

ROOT=Path(__file__).resolve().parents[2]
DOCS=ROOT/'docs'
BOOK=ROOT/'experiments/book-ab/starlight/src/content/docs'
OUT=DOCS/'assets/experimentos/livros/b'
AREAS={'produto':'01-produto','plataforma':'02-plataforma',
       'frontend':'03-interfaces','operacao':'04-operacao',
       'qualidade':'05-infra-qualidade'}
ANCHORS=('estado','casos-de-uso','historias-de-usuario','requisitos',
 'arquitetura','contratos','apis','eventos','dados','schema',
 'dependencias','configuracao','interface','testes','operacao','wbs',
 'registro-de-alteracoes')


class ContinuousBookTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.units=json.loads((DOCS/'subprojects/index.json').read_text())['units']

    def test_all_modules_are_single_anchored_pages(self):
        self.assertEqual(57,len(self.units))
        self.assertEqual(57,len({u['id'] for u in self.units}))
        for unit in self.units:
            area=AREAS[unit['front']]
            uid=unit['id'].lower()
            source=BOOK/area/(uid+'.md')
            output=OUT/area/uid/'index.html'
            self.assertTrue(source.is_file(),source)
            self.assertTrue(output.is_file(),output)
            self.assertFalse((BOOK/area/uid).exists())
            self.assertFalse((OUT/area/uid/'apis'/'index.html').exists())
            markdown=source.read_text()
            html=output.read_text()
            for slug in ANCHORS:
                self.assertIn('](#'+slug+')',markdown,unit['id'])
                self.assertIn('id="'+slug+'"',html,unit['id'])
            self.assertNotIn('## Documentação de origem integral',markdown)
            self.assertIn('Espaço para alterações',markdown)
            for _,_,filename in TOPICS:
                chapter=(ROOT/unit['entry']).parent/'chapters'/filename
                if chapter.is_file():
                    marker='**Fonte completa:** ['+chapter.relative_to(ROOT).as_posix()+']'
                    self.assertEqual(1,markdown.count(marker),str(chapter))

    def test_technical_reference_is_never_truncated(self):
        for u in self.units:
            path=ROOT/u['technicalReference']
            if path.is_file():
                raw=path.read_text()
                self.assertEqual(raw,''.join(v for _,v in complete_heading_blocks(raw)))

    def test_a06_has_real_content_inline(self):
        text=(BOOK/'02-plataforma/a06.md').read_text()
        for value in ['GET /healthz','createAccountAccessServer',
                      'apply_tenant_account_delegation','Grant/revoke idempotente']:
            self.assertIn(value,text)
        self.assertIn('## APIs e endpoints',text)
        self.assertIn('## Schemas e migrations',text)

    def test_generator_is_idempotent(self):
        file=BOOK/'02-plataforma/a06.md'
        before=file.read_bytes()
        render()
        self.assertEqual(before,file.read_bytes())


if __name__=='__main__':
    unittest.main()
