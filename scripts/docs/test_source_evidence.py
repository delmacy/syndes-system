"""Regression detection for curated contract witnesses (no test environment needed)."""
from pathlib import Path
import json
import shutil
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"scripts/docs"))
from source_evidence import validate

class SourceEvidenceTests(unittest.TestCase):
    def test_known_witnesses_match_current_source_and_docs(self):
        self.assertEqual(validate(ROOT),[])

    def test_removed_method_is_reported(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            manifest=json.loads((ROOT/"docs/evidence/contract-witnesses.json").read_text())
            manifest["witnesses"]=[w for w in manifest["witnesses"] if w["id"]=="C03-A04-VERIFIER"]
            target=root/"docs/evidence/contract-witnesses.json"
            target.parent.mkdir(parents=True)
            target.write_text(json.dumps(manifest))
            witness=manifest["witnesses"][0]
            for relative in (witness["source"],witness["document"]):
                dst=root/relative
                dst.parent.mkdir(parents=True,exist_ok=True)
                shutil.copy2(ROOT/relative,dst)
            src=root/witness["source"]
            src.write_text(src.read_text().replace("verifyClient(","renamedClient("))
            issues=validate(root)
            self.assertTrue(any("symbol not found" in issue for issue in issues))

    def test_removed_documented_symbol_is_reported(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            manifest=json.loads((ROOT/"docs/evidence/contract-witnesses.json").read_text())
            manifest["witnesses"]=[w for w in manifest["witnesses"] if w["id"]=="C03-A05-CLIENT"]
            target=root/"docs/evidence/contract-witnesses.json"
            target.parent.mkdir(parents=True)
            target.write_text(json.dumps(manifest))
            witness=manifest["witnesses"][0]
            for relative in (witness["source"],witness["document"]):
                dst=root/relative
                dst.parent.mkdir(parents=True,exist_ok=True)
                shutil.copy2(ROOT/relative,dst)
            doc=root/witness["document"]
            doc.write_text(doc.read_text().replace("createMasterTokenVerifier","tokenVerifierRenamed"))
            self.assertTrue(any("not present in declared documentation" in x for x in validate(root)))

if __name__=="__main__":unittest.main()
