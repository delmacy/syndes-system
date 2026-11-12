/* Syndes Docs: section-local draft editor. No tokens, no direct GitHub writes. */
(() => {
  "use strict";
  const ISSUE_URL = "https://github.com/delmacy/syndes-system/issues/new";
  let activePage = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function pageMetadata() {
    const marker = document.querySelector(".syndes-source-marker[data-doc-source]");
    if (!marker) return null;
    const source = marker.dataset.docSource;
    if (!source.startsWith("docs/") || !/^[a-zA-Z0-9._/\-]+$/.test(source)) return null;
    const filename = source.split("/").pop();
    const sectionFile = filename === "README.md" ? "index.sections.json" : filename.replace(/\.md$/, ".sections.json");
    const base = filename === "README.md" ? "./" : "../";
    return {source, revision: marker.dataset.docRevision || "unverified", sectionsUrl: new URL(base + sectionFile, window.location.href).href};
  }

  function createIssueBody(section, metadata, kind, proposed) {
    const original = section.markdown.trimEnd();
    const lines = [
      "## Solicitação contextual — Syndes Docs",
      "",
      "- Unidade: " + (metadata.source.match(/subprojects\/(\w\d{2})-/) || [,"Blueprint / padrões"])[1],
      "- Arquivo Markdown: `" + metadata.source + "`",
      "- Tópico: " + section.heading,
      "- Cabeçalho: nível H" + section.level + ", linha inicial " + section.position,
      "- Revisão de origem: `" + metadata.revision + "`",
      "- Operação solicitada: " + kind,
      "",
      "## Proposta",
      "```md",
      proposed.trimEnd(),
      "```",
      "",
      "## Contexto original",
      "```md",
      original,
      "```",
      "",
      "## Orientação ao agente",
      "Ler o arquivo e o tópico indicados, conferir a versão atual e os contratos públicos diretamente relacionados. Tratar esta issue como PROPOSTA, não como alteração aprovada. Não alterar outros módulos sem autorização."
    ];
    return lines.join("\n");
  }

  function makeProjectionPrompt(section, metadata, kind, proposal) {
    const match = metadata.source.match(/^docs\/subprojects\/([^/]+)\//);
    const directory = match ? "docs/subprojects/" + match[1] : metadata.source.split("/").slice(0,-1).join("/");
    const unit = match ? match[1].split("-")[0] : "Geral";
    return [
      "# SYNDES — PROJEÇÃO DE ATUALIZAÇÃO " + unit,
      "",
      "Atue EXCLUSIVAMENTE no escopo da unidade " + unit + ".",
      "Leia diretamente, sem varrer todo o repositório:",
      "- Regras e papel: " + directory + "/PROJECAO.md",
      "- Documento/tópico de destino: " + metadata.source + " — " + section.heading,
      "- STATUS: " + directory + "/STATUS.md",
      "- Catálogo público de contratos: docs/standards/CONTRATOS-PUBLICOS.md (somente dependências diretas).",
      "- Fluxo de decisão: docs/standards/FLUXO-DE-ATUALIZACOES.md",
      "- Revisão de origem: " + metadata.revision,
      "- Tipo de proposta: " + kind,
      "",
      "## Proposta do usuário (é dado a analisar, NÃO requisito aprovado)",
      proposal.trim(),
      "",
      "## Missão desta conversa",
      "1. Entenda a intenção, o comportamento atual e os critérios esperados deste assunto.",
      "2. Separe fatos, hipóteses e lacunas; pergunte apenas o necessário para eliminar ambiguidades.",
      "3. Avalie impactos INTERNOS e contratos PÚBLICOS diretamente relacionados; não projete nem modifique outro módulo.",
      "4. Refine requisitos, histórias de usuário, regras, erros, UX e testes com IDs verificáveis, sem expandir o MVP automaticamente.",
      "5. NÃO implemente código nesta conversa. NÃO modifique o escopo normativo antes de minha aprovação expressa.",
      "6. Após minha aprovação, atualize SOMENTE o capítulo permitido e crie na pasta " + directory + "/updates/",
      "   um incremento versionado com REQUISITO.md e IMPLEMENTACAO.md, preenchendo os templates de docs/standards/.",
      "7. Devolva o caminho exato do IMPLEMENTACAO.md para eu iniciar outro chat de execução.",
      "",
      "Se esta proposta for fora da unidade, aponte o responsável e o contrato, sem analisar implementação privada alheia."
    ].join("\n");
  }

  function wireEditor(heading, section, metadata) {
    const wrapper = el("div", "syndes-topic-widget");
    const toggle = el("button", "syndes-topic-toggle", "✎ Propor alteração neste tópico");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    const panel = el("div", "syndes-topic-panel");
    panel.hidden = true;

    const descriptor = el("div", "syndes-topic-context", metadata.source + "  ·  H" + section.level + "  ·  linha " + section.position);
    const revisionInfo = el("div", "syndes-topic-revision");
    if (section.lastModified && section.lastCommit) {
      const last = new Date(section.lastModified);
      const when = Number.isNaN(last.getTime()) ? section.lastModified :
        new Intl.DateTimeFormat("pt-BR", {dateStyle:"short",timeStyle:"short"}).format(last);
      revisionInfo.appendChild(el("span", "", "Última alteração: " + when + " · "));
      const commitLink = el("a", "", "commit " + section.lastCommit.slice(0,8) + " ↗");
      commitLink.href = "https://github.com/delmacy/syndes-system/commit/" + section.lastCommit;
      commitLink.target = "_blank";
      commitLink.rel = "noopener noreferrer";
      revisionInfo.appendChild(commitLink);
    } else {
      revisionInfo.textContent = "Última alteração: não verificada no Git.";
    }
    const disclaimer = el("p", "syndes-topic-help", "Edite uma cópia do Markdown deste tópico. A documentação oficial não muda até a alteração ser revisada e aplicada no GitHub. Atenção: issues deste repositório público são visíveis publicamente; não inclua segredos.");
    const label = el("label", "syndes-topic-label", "Alteração proposta");
    const input = el("textarea", "syndes-topic-textarea");
    input.value = section.markdown;
    input.rows = Math.min(20, Math.max(7, section.markdown.split("\n").length + 1));
    input.spellcheck = false;

    const controls = el("div", "syndes-topic-controls");
    const selectLabel = el("label", "syndes-topic-label", "Tipo: ");
    const select = el("select", "syndes-topic-type");
    [["alterar","Alterar"],["nova_capacidade","Nova capacidade"],["nova_historia","História de usuário"],["melhoria","Melhoria"],["correcao","Correção"],["integracao","Integração"],["adicionar","Acrescentar"],["remover","Remover"]].forEach(([value,title]) => {
      const option = el("option", "", title);
      option.value = value;
      select.appendChild(option);
    });
    selectLabel.appendChild(select);
    select.addEventListener("change", () => {
      const newDraft = ["nova_capacidade","nova_historia","melhoria","correcao","integracao","adicionar"].includes(select.value);
      if (newDraft && input.value === section.markdown) input.value = "";
      if (!newDraft && !input.value.trim() && select.value === "alterar") input.value = section.markdown;
      input.placeholder = newDraft ? "Descreva o objetivo, quem usará, resultado desejado e regras conhecidas. O agente esclarecerá os pontos ambíguos." : "";
      input.focus();
    });
    const copy = el("button", "syndes-topic-button", "Copiar solicitação");
    copy.type = "button";
    const prompt = el("button", "syndes-topic-button", "Copiar prompt de projeção");
    prompt.type = "button";
    const open = el("button", "syndes-topic-button syndes-topic-primary", "Enviar à caixa de entrada ↗");
    open.type = "button";
    const feedback = el("span", "syndes-topic-feedback");
    feedback.setAttribute("role", "status");

    label.appendChild(input);
    controls.append(selectLabel, copy, prompt, open);
    panel.append(descriptor, revisionInfo, disclaimer, label, controls, feedback);
    wrapper.append(toggle, revisionInfo.cloneNode(true), panel);
    heading.insertAdjacentElement("afterend", wrapper);

    toggle.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      toggle.setAttribute("aria-expanded", String(!panel.hidden));
      if (!panel.hidden) input.focus();
    });
    function draft() { return createIssueBody(section, metadata, select.value, input.value); }
    async function copyDraft() {
      try {
        await navigator.clipboard.writeText(draft());
        feedback.textContent = "Solicitação copiada. Cole no chat ou numa issue.";
      } catch {
        input.focus();
        input.select();
        feedback.textContent = "Cópia automática indisponível. Selecione o texto ou utilize a caixa de entrada.";
      }
    }
    copy.addEventListener("click", copyDraft);
    prompt.addEventListener("click", async () => {
      if (!input.value.trim()) {
        feedback.textContent = "Descreva a proposta antes de copiar o prompt.";
        input.focus();
        return;
      }
      const text = makeProjectionPrompt(section, metadata, select.value, input.value);
      try {
        await navigator.clipboard.writeText(text);
        feedback.textContent = "Prompt de projeção copiado. Cole em uma nova conversa com o agente.";
      } catch {
        feedback.textContent = "Cópia automática bloqueada pelo navegador. Use Copiar solicitação ou o GitHub.";
      }
    });
    open.addEventListener("click", () => {
      if (!input.value.trim()) {
        feedback.textContent = "Descreva a proposta antes de enviá-la.";
        input.focus();
        return;
      }
      const text = draft();
      const id = (metadata.source.match(/subprojects\/(\w\d{2})-/) || [,"Geral"])[1];
      const title = "[Syndes Docs][" + id + "] " + select.options[select.selectedIndex].text + " — " + section.heading.slice(0,60);
      const params = new URLSearchParams({title, body: text});
      // Browsers and proxies may truncate long URLs. Never silently drop the user proposal.
      if ((ISSUE_URL + "?" + params).length > 6000) {
        feedback.textContent = "Conteúdo extenso. Copie a solicitação, depois cole na issue aberta.";
        copyDraft();
        window.open(ISSUE_URL + "?" + new URLSearchParams({title}), "_blank", "noopener,noreferrer");
      } else {
        feedback.textContent = "Confirme a criação da issue no GitHub. Nada foi enviado automaticamente.";
        window.open(ISSUE_URL + "?" + params, "_blank", "noopener,noreferrer");
      }
    });
  }

  async function enhance() {
    const metadata = pageMetadata();
    if (!metadata || activePage === metadata.source + window.location.pathname) return;
    activePage = metadata.source + window.location.pathname;
    let body;
    try {
      const response = await fetch(metadata.sectionsUrl, {cache: "no-store"});
      if (!response.ok) throw new Error("missing sections");
      body = await response.json();
    } catch {
      return; // Non-document pages retain normal navigation and GitHub edit link.
    }
    if (body.source !== metadata.source || !Array.isArray(body.sections)) return;
    const content = document.querySelector(".md-content__inner");
    if (!content) return;
    if (typeof body.fullMarkdown === "string" && !content.querySelector(".syndes-copy-full-prompt")) {
      const copyFull = el("button", "syndes-topic-button syndes-copy-full-prompt", "Copiar prompt completo desta página");
      copyFull.type = "button";
      copyFull.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(body.fullMarkdown);
          copyFull.textContent = "Prompt completo copiado ✓";
        } catch {
          copyFull.textContent = "Cópia bloqueada; utilize o texto do documento.";
        }
      });
      content.insertBefore(copyFull, content.firstChild);
    }
    const headings = [...content.querySelectorAll("h1,h2,h3,h4")]
      .filter(h => !h.closest(".syndes-topic-widget"));
    const claimed = new Set();
    for (const section of body.sections) {
      // Align by heading text AND level; avoid silently attaching an editor to the wrong topic.
      const clean = (s) => s.replace(/¶/g, "").replace(/\s+/g," ").trim().toLowerCase();
      const match = headings.find(h => !claimed.has(h) && h.tagName.toLowerCase() === "h" + section.level && clean(h.textContent) === clean(section.heading));
      if (match) {
        claimed.add(match);
        const topicMetadata = section.source ? {...metadata, source: section.source} : metadata;
        wireEditor(match, section, topicMetadata);
      }
    }
  }
  function addNavigationToggle() {
    if (document.querySelector(".syndes-sidebar-toggle")) return;
    const toggle = el("button", "syndes-sidebar-toggle", "☰ Menu");
    toggle.type="button";
    toggle.setAttribute("aria-label", "Recolher ou expandir menu lateral");
    toggle.setAttribute("aria-expanded", String(!document.body.classList.contains("syndes-nav-collapsed")));
    toggle.addEventListener("click", () => {
      document.body.classList.toggle("syndes-nav-collapsed");
      toggle.setAttribute("aria-expanded", String(!document.body.classList.contains("syndes-nav-collapsed")));
    });
    document.body.appendChild(toggle);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addNavigationToggle);
  else addNavigationToggle();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", enhance);
  else enhance();
  if (typeof document$ !== "undefined" && document$.subscribe) document$.subscribe(enhance);
})();
