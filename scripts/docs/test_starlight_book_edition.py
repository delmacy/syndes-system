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
            for term in ['## Identificação e rastreabilidade','## Situação registrada','## Matérias deste capítulo','## Referências operacionais e evolução','**Leitura técnica, não homologação.**','STATUS original','REFERENCIA-TECNICA','OPERACAO']:
                self.assertIn(term,contents,sid)
            self.assertIn(unit['source'],contents,sid)
            self.assertIn(unit['id'],contents,sid)
            self.assertIn('https://github.com/delmacy/syndes-system/blob/main/',contents,sid)
            self.assertTrue((OUT/area/sid.lower()/'index.html').is_file(),sid)

    def test_topic_pages_are_real_independent_documents(self):
        total=0
        for unit in self.units:
            sid=unit['id']; area=AREA[unit['front']]
            source=ROOT/unit['entry']
            for _,_,name in TOPICS:
                p=source.parent/'chapters'/name
                if not p.is_file():continue
                self.assertTrue((BOOK/area/sid.lower()/p.name).is_file(),p)
                self.assertTrue((OUT/area/sid.lower()/p.stem/'index.html').is_file(),p)
                total+=1
        self.assertEqual(total,sum(x['topics'] for x in self.manifest))
        self.assertGreaterEqual(total,440)

    def test_independent_technical_subchapters_and_navigation(self):
        for unit in self.units:
            uid=unit['id']; area=AREA[unit['front']]
            book=(BOOK/area/(uid.lower()+'.md')).read_text()
            for slug,title,_,_ in SUBCHAPTERS:
                source=BOOK/area/uid.lower()/(slug+'.md')
                output=OUT/area/uid.lower()/slug/'index.html'
                self.assertTrue(source.is_file(),source)
                self.assertTrue(output.is_file(),output)
                self.assertIn('./'+slug+'/',book)
                page=source.read_text()
                self.assertIn('Referências verificáveis',page)
                self.assertIn('não homologação',page)
                self.assertIn('STATUS original',page)
        self.assertEqual(798,len(self.units)*len(SUBCHAPTERS))

    def test_no_claim_of_functional_homologation(self):
        for u in self.units:
            contents=(BOOK/AREA[u['front']]/(u['id'].lower()+'.md')).read_text()
            self.assertIn('não significa',contents)
            self.assertIn('documentação canônica permanece',contents)

if __name__=='__main__':unittest.main()
