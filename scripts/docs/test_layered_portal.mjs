import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const source = readFileSync(join(root, "docs/assets/module-directory.js"), "utf8");
class Element {
  constructor(tag = "div") {
    this.tag = tag;
    this.children = [];
    this.textContent = "";
    this.value = "";
    this.hidden = false;
    this.handlers = {};
  }
  append(...elements) { this.children.push(...elements); }
  replaceChildren(...elements) { this.children = elements; }
  addEventListener(name, handler) { this.handlers[name] = handler; }
  dispatch(name) { this.handlers[name]?.(); }
}

test("catalog filters by source-backed layer without duplicating component modules", async () => {
  const search = new Element("input");
  const area = new Element("select");
  area.options = [{value:""}, {value:"produto"}, {value:"plataforma"}, {value:"qualidade"}];
  const layer = new Element("select");
  layer.value = "dominio";
  const evidence = new Element("input");
  evidence.checked = false;
  const evidenceWrap = new Element();
  const state = new Element();
  const results = new Element();
  const title = new Element();
  const note = new Element();
  const selectors = {
    "#syndes-catalog-search": search, "#syndes-catalog-area": area,
    "#syndes-catalog-layer": layer, "#syndes-catalog-evidence": evidence,
    ".syndes-evidence-filter": evidenceWrap, ".syndes-catalog-state": state,
    ".syndes-catalog-results": results, ".syndes-catalog-layer-title": title,
    ".syndes-catalog-layer-note": note
  };
  const host = { querySelector: key => selectors[key] };
  const base = "https://delmacy.github.io/syndes-system/blueprint/CATALOGO-MODULOS/";
  const locations = [];
  const window = {
    location: {href: base + "?camada=dados&area=produto", search: "?camada=dados&area=produto"},
    history: {replaceState: (_state, _title, url) => locations.push(String(url))}
  };
  const sample = {
    modules: [
      {id:"P01",name:"CRM",area:"produto",source:"modules/core-crm",
       home:"/crm/",documentationParent:null,searchTerms:["CrmService","crm_people"],
       sqlTableCount:2,publicExportCount:1,anchors:{database:"/crm/sql",publicContracts:"/crm/exports"}},
      {id:"P02",name:"Inbox",area:"produto",source:"modules/inbox",
       home:"/inbox/",documentationParent:null,searchTerms:["InboxService"],
       sqlTableCount:0,publicExportCount:0,anchors:{database:"/inbox/sql",publicContracts:"/inbox/exports"}},
      {id:"I09",name:"runtime",area:"qualidade",source:"modules/whatsapp/gateway",
       home:"/child/",documentationParent:"P03",anchors:{}},
      {id:"Q02",name:"Unit tests",area:"qualidade",source:"tests/unit",
       home:"/tests/",documentationParent:null,searchTerms:[],sqlTableCount:0,publicExportCount:0,anchors:{}}
    ]
  };
  const context = {
    document: {getElementById: id => id === "syndes-catalog" ? host : null, createElement: tag => new Element(tag)},
    window, URL, URLSearchParams, fetch: async () => ({ok:true,json:async () => sample})
  };
  runInNewContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(title.textContent, "Banco, schemas e SQL");
  assert.equal(results.children.length, 2, "Area filter should show two product modules");
  assert.match(state.textContent, /1 com declarações/);
  assert.equal(results.children[0].children[3].children[0].href, "/crm/sql");

  evidence.checked = true;
  evidence.dispatch("change");
  assert.equal(results.children.length, 1);
  search.value = "crm_people";
  search.dispatch("input");
  assert.equal(results.children.length, 1, "Source symbol should be searchable");
  assert.match(locations.at(-1), /q=crm_people/);

  search.value = "";
  area.value = "";
  layer.value = "contratos";
  evidence.checked = false;
  layer.dispatch("change");
  assert.equal(results.children.length, 3, "Parent component should not duplicate product modules");
  assert.equal(results.children[0].children[3].children[0].href, "/crm/exports");
  assert.equal(evidenceWrap.hidden, false);
  layer.value = "dominio";
  layer.dispatch("change");
  assert.equal(evidenceWrap.hidden, true);
});
