/* Read-only catalog: a single technical layer at a time, backed by build-generated source evidence. */
(function () {
  "use strict";
  const host = document.getElementById("syndes-catalog");
  if (!host) return;

  const search = host.querySelector("#syndes-catalog-search");
  const area = host.querySelector("#syndes-catalog-area");
  const layer = host.querySelector("#syndes-catalog-layer");
  const evidence = host.querySelector("#syndes-catalog-evidence");
  const evidenceWrap = host.querySelector(".syndes-evidence-filter");
  const state = host.querySelector(".syndes-catalog-state");
  const results = host.querySelector(".syndes-catalog-results");
  const title = host.querySelector(".syndes-catalog-layer-title");
  const note = host.querySelector(".syndes-catalog-layer-note");

  const areaNames = {
    produto: "Produto", operacao: "Operação", plataforma: "Plataforma",
    frontend: "Frontend", infraestrutura: "Infraestrutura", qualidade: "Qualidade"
  };
  const layers = {
    dominio: {
      title: "Domínio e capacidades", anchor: "capabilities",
      note: "Responsabilidades e especificações. Requisito documentado não comprova implementação."
    },
    dados: {
      title: "Banco, schemas e SQL", anchor: "database", key: "sqlTableCount", unit: "tabelas SQL declaradas",
      note: "Tabelas encontradas nos arquivos SQL do owner. Não comprova migrations aplicadas nem destino Tenant/Control DB."
    },
    interfaces: {
      title: "Interfaces e aplicações", anchor: "frontend", key: "frontendCandidateCount", unit: "arquivos candidatos",
      note: "Arquivos React encontrados por nome. Não comprova rota, habilitação ou concessão de acesso."
    },
    contratos: {
      title: "Contratos públicos", anchor: "publicContracts", key: "publicExportCount", unit: "entrypoints declarados",
      note: "Exports de manifesto do pacote, não garantia de compatibilidade ou API habilitada."
    },
    internos: {
      title: "Classes e métodos internos", anchor: "privateMethods", key: "methodCount", unit: "métodos detectados",
      note: "Declarações para localização. Métodos públicos em TypeScript não são necessariamente contratos de módulo."
    },
    apis: {
      title: "APIs HTTP registradas", anchor: "http", key: "httpDecoratorCount", unit: "decorators HTTP",
      note: "Decorators encontrados no código, inclusive controllers. Validar a rota final, autorização e ativação no Host."
    },
    dependencias: {
      title: "Dependências e stack", anchor: "dependencies", key: "dependencyCount", unit: "dependências de manifesto",
      note: "Pacotes declarados em package.json. Não descreve automaticamente dependências de execução entre módulos."
    },
    operacao: {
      title: "Operação e hospedagem", anchor: "operation",
      note: "Ambientes, serviços de apoio, implantação e rotinas operacionais de cada unidade."
    },
    qualidade: {
      title: "Testes, status e evidências", anchor: "quality",
      note: "Status e gates; commits e workpackages isolados não significam aceite operacional."
    }
  };

  const params = new URLSearchParams(window.location.search);
  if (params.has("q")) search.value = params.get("q").slice(0, 100);
  if ([...area.options].some(o => o.value === params.get("area"))) area.value = params.get("area");
  if (Object.prototype.hasOwnProperty.call(layers, params.get("camada"))) layer.value = params.get("camada");

  const normalized = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const group = mod => mod.id.startsWith("I") ? "infraestrutura" : mod.area;
  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const makeLink = (url, label, className) => {
    const a = create("a", className, label);
    a.href = url;
    a.rel = "noopener";
    return a;
  };
  const formatEvidence = (mod, selected) => {
    if (!selected.key) return "Documentação da unidade · verifique status e fonte";
    const count = Number(mod[selected.key]) || 0;
    return count ? count + " " + selected.unit + " · extração sintática" : "Sem declaração identificada neste escopo";
  };

  let modules = [];
  let loaded = false;
  function render() {
    const selected = layers[layer.value] || layers.dominio;
    const query = normalized(search.value.trim());
    const filterArea = area.value;
    title.textContent = selected.title;
    note.textContent = selected.note;
    evidenceWrap.hidden = !selected.key;
    const filtered = modules.filter(mod => {
      if (mod.documentationParent) return false;
      if (filterArea && group(mod) !== filterArea) return false;
      if (selected.key && evidence.checked && !Number(mod[selected.key])) return false;
      if (!query) return true;
      return normalized([mod.id, mod.name, mod.canonicalName, mod.source, areaNames[group(mod)],
        ...(Array.isArray(mod.searchTerms) ? mod.searchTerms : [])].join(" ")).includes(query);
    });

    const tracked = modules.length;
    const hits = selected.key ? filtered.filter(mod => Number(mod[selected.key]) > 0).length : null;
    state.textContent = !loaded ? "Carregando inventário…" :
      filtered.length + " módulos visíveis · " + tracked + " unidades rastreadas" +
      (hits === null ? "" : " · " + hits + " com declarações nesta camada") +
      " · evidência de código, não homologação";
    results.replaceChildren();
    if (!loaded) return;

    for (const mod of filtered) {
      const card = create("article", "syndes-catalog-entry");
      const heading = create("h3");
      heading.append(makeLink(mod.home, mod.id + " · " + mod.name));
      card.append(heading);

      const origin = create("p", "syndes-catalog-meta");
      origin.append(create("span", "syndes-catalog-area", areaNames[group(mod)] + " · "));
      origin.append(create("code", "", mod.source));
      card.append(origin);
      card.append(create("p", "syndes-catalog-evidence", formatEvidence(mod, selected)));

      const actions = create("div", "syndes-catalog-links");
      const linkTarget = mod.anchors && mod.anchors[selected.anchor];
      if (linkTarget) actions.append(makeLink(linkTarget, "Abrir " + selected.title.toLowerCase(), "syndes-catalog-primary"));
      actions.append(makeLink(mod.home, "Ficha completa", "syndes-catalog-secondary"));
      card.append(actions);
      results.append(card);
    }
    if (filtered.length === 0) {
      results.append(create("p", "syndes-catalog-empty",
        "Nenhum módulo corresponde aos filtros. Remova o texto, altere a área ou desative o filtro de evidências."));
    }
  }
  function updateUrl() {
    const url = new URL(window.location.href);
    for (const [key, value] of [["q", search.value.trim()], ["area", area.value], ["camada", layer.value]]) {
      if (value && (key !== "camada" || value !== "dominio")) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    if (window.history && window.history.replaceState) window.history.replaceState(null, "", url);
  }
  const changed = () => { updateUrl(); render(); };
  search.addEventListener("input", changed);
  area.addEventListener("change", changed);
  layer.addEventListener("change", changed);
  evidence.addEventListener("change", render);

  render();
  const inventoryUrl = new URL("../../assets/catalog/modules.json", window.location.href);
  fetch(inventoryUrl, {cache: "no-cache"}).then(response => {
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.json();
  }).then(data => {
    if (!data || !Array.isArray(data.modules)) throw new Error("Registro técnico inválido");
    modules = data.modules;
    loaded = true;
    render();
  }).catch(() => {
    state.textContent = "Índice temporariamente indisponível. Use o menu por módulo ou consulte as fontes no GitHub.";
  });
})();
