"""Contract gates for the isolated Starlight book edition."""
import json
import unittest
from pathlib import Path
from enrich_starlight_book import TOPICS, SUBCHAPTERS

ROOT=Path(__file__).resolve().parents[2]
DOCS=ROOT/'docs'
BOOK=ROOT/'experiments/book-ab/starlight/src/content/docs'
OUT=DOCS/'assets/experimentos/livros/b'
AREA={'produto':'01-produto','plataforma':'02-plataforma','frontend':'03-interfaces','operacao':'04-operacao','qualidade':'05-infra-qualidade'}

class BookEditionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.units=json.loads((DOCS/'subprojects/index.json').read_text())['units']
        cls.manifest=json.loads((ROOT/'experiments/book-ab/starlight/chapters-manifest.json').read_text())

    def test_catalog_and_volume_coverage(self):
        self.assertEqual(57,len(self.units))
        self.assertEqual({u['id'] for u in self.units},{u['id'] for u in self.manifest})
        self.assertEqual(57,len({u['id'] for u in self.units}))
        for area,slug in AREA.items():
            self.assertTrue((BOOK/slug/'index.md').is_file())
            self.assertTrue((OUT/slug/'index.html').is_file())
        self.assertTrue((OUT/'index.html').is_file())

    def test_every_chapter_follows_uniform_ficha_and_source(self):
        for unit in self.units:
            sid=unit['id']; area=AREA[unit['front']]
            p=BOOK/area/(sid.lower()+'.md')
            self.assertTrue(p.is_file(),p)
            contents=p.read_text()
            for term in ['## Identificação e rastreabilidade','## Situação registrada','## Índice dos subcapítulos','## Controle de alterações','**Leitura técnica, não homologação.**','STATUS original','REFERENCIA-TECNICA','OPERACAO']:
                self.assertIn(term,contents,sid)
            self.assertIn(unit['source'],contents,sid)
            self.assertIn(unit['id'],contents,sid)
            self.assertIn('https://github.com/delmacy/syndes-system/blob/main/',contents,sid)
            self.assertTrue((OUT/area/sid.lower()/'index.html').is_file(),sid)

    def test_all_subchapters_are_anchors_in_one_module_page(self):
        import re
        for unit in self.units:
            uid=unit['id']; area=AREA[unit['front']]
            source=BOOK/area/(uid.lower()+'.md')
            html=OUT/area/uid.lower()/'index.html'
            self.assertTrue(source.is_file(),source)
            self.assertTrue(html.is_file(),html)
            page=source.read_text(encoding='utf-8')
            rendered=html.read_text(encoding='utf-8')
            for slug,title,_,_ in SUBCHAPTERS:
                self.assertIn('## '+title,page)
                self.assertIn('<a id="'+slug+'"></a>',page)
                self.assertIn('](#'+slug+')',page)
                self.assertIn('id="'+slug+'"',rendered)
                self.assertFalse((BOOK/area/uid.lower()/(slug+'.md')).exists())
                self.assertFalse((OUT/area/uid.lower()/slug/'index.html').exists())
            self.assertEqual(1,page.count('## Controle de alterações'))
            self.assertIn('Espaço para ajustes e implementação',page)
            self.assertIn('https://github.com/delmacy/syndes-system/edit/main/',page)
            self.assertIn('Documentação de origem integral',page)
            for _,_,filename in TOPICS:
                original=ROOT/unit['entry']
                doc=original.parent/'chapters'/filename
                if doc.is_file():
                    self.assertIn(doc.name,page)
            self.assertIn('tableOfContents', (ROOT/'experiments/book-ab/starlight/astro.config.mjs').read_text())

    def test_no_claim_of_functional_homologation(self):
        for u in self.units:
            contents=(BOOK/AREA[u['front']]/(u['id'].lower()+'.md')).read_text()
            self.assertIn('não significa',contents)
            self.assertIn('documentação canônica permanece',contents)

if __name__=='__main__':unittest.main()
