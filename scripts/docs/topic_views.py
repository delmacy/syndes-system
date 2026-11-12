"""Materialize topic-isolated module pages from canonical reference and source inventories.

The generated views are *not* new sources of truth. The authored sections link to their
exact versioned Markdown origin, while extracted symbols target code-change proposals.
"""
from __future__ import annotations

from pathlib import Path
import re
import unicodedata

TAB_SPECS = (
    ("APIS.md", "APIs", "Rotas HTTP identificadas no código. A ativação, os grants e o path efetivo exigem verificação no Host."),
    ("DADOS.md", "Dados", "Entidades, persistência e SQL declarados. Migration encontrada não comprova aplicação nem tenant."),
    ("CONTRATOS.md", "Contratos", "Contratos oferecidos ao consumidor, exports e integração. Declaração não comprova compatibilidade operacional."),
    ("CODIGO.md", "Código", "Stack, classes, métodos, interfaces e frontends localizados no código e em sua referência técnica."),
    ("DEPENDENCIAS.md", "Dependências", "Bibliotecas de manifesto e versões declaradas. Dependência instalada ou usada requer verificação adicional."),
    ("TESTES.md", "Testes", "Evidências de testes e critérios de validação. Planejamento, commit e CI não equivalem a aceite."),
)

# Exact headings emitted by code_inventory.render() — no cross-category reusing.
INVENTORY_TOPICS = {
    "APIS.md": ("Endpoints HTTP anotados",),
    "DADOS.md": ("Schemas e arquivos SQL",),
    "CONTRATOS.md": ("Contratos públicos declarados pelo pacote",),
    "CODIGO.md": ("Classes, interfaces e tipos encontrados", "Métodos de classes e visibilidade interna",
                  "Frontend identificado por arquivo candidato", "Gateway Go: funções e tipos exportados"),
    "DEPENDENCIAS.md": ("Dependências declaradas no manifesto",),
    "TESTES.md": (),
}

def normalize(value):
    value=re.sub(r"\{\{?#[^}]+\}\}?", "", value)
    return "".join(ch for ch in unicodedata.normalize("NFD",value.lower())
                   if unicodedata.category(ch)!="Mn").strip()

def reference_topic(heading):
    """Conservative classification of existing H2 headings; ambiguous source remains accessible in legacy."""
    name=normalize(heading)
    name=re.sub(r"^\d+\.\s*", "", name)
    if "diagrama" in name and ("teste" in name or "pendencia" in name):
        return "TESTES.md"
    if any(word in name for word in ("evidencia", "divida tecnica", "pendencia", "risco")):
        return "TESTES.md"
    if "schema" in name or "migration" in name or "persistencia" in name or "dados" in name:
        return "DADOS.md"
    if "contratos" in name or "exports" in name:
        return "CONTRATOS.md"
    if "endpoint" in name or "http" in name or name.startswith("api") or "apis e seguranca" in name:
        return "APIS.md"
    if any(word in name for word in ("stack", "classes", "metodos", "frontend",
                                    "funcoes", "composicao do modulo", "backend")):
        return "CODIGO.md"
    return None

def topic_views(uid, name, source_reference, reference_sections, inventory_sections, revision, code_source):
    """Return filename -> (page Markdown, contextual editor metadata) per category.

    reference_sections: heading-scoped records read from the canonical Markdown BEFORE
    the extracted inventory was appended. inventory_sections: headings from the generated
    extract; all must be marked generated, never editable as a physical Markdown.
    """
    output={}
    for filename, label, description in TAB_SPECS:
        pages=[]
        entries=[]
        for index,section in enumerate(reference_sections):
            if section.get("level")!=2 or reference_topic(section["heading"])!=filename:
                continue
            page=section["markdown"].rstrip()
            # Export tables are public package contracts, not source-code implementation.
            # The 45 generic references keep this H3 under "Stack e ownership";
            # show it on Contracts only, without altering the canonical source file.
            if filename=="CODIGO.md":
                page=re.sub(r"(?ms)^###\s+Exports declarados no manifesto[^\n]*\n.*?(?=^###\s+|\Z)",
                            "",page).rstrip()
            pages.append(page)
            entries.append(dict(section,source=source_reference))
            for child in reference_sections[index+1:]:
                if child.get("level",0)<=2:
                    break
                if filename=="CODIGO.md" and normalize(child["heading"]).startswith("exports declarados"):
                    continue
                entries.append(dict(child,source=source_reference))
        if filename=="CONTRATOS.md":
            for child in reference_sections:
                if child.get("level")!=3 or not normalize(child["heading"]).startswith("exports declarados no manifesto"):
                    continue
                # Exact H3 source slice; displayed as H2 in the destination page.
                pages.append(re.sub(r"^###\s+", "## ",child["markdown"].rstrip(),count=1))
                entries.append(dict(child,level=2,source=source_reference))
        inventory_titles={normalize(t) for t in INVENTORY_TOPICS[filename]}
        for section in inventory_sections:
            if section.get("level")!=3 or normalize(section["heading"]) not in inventory_titles:
                continue
            # Promote inventory H3 into the page-level table of contents, without changing evidence.
            page=re.sub(r"^###\s+", "## ", section["markdown"].rstrip(),count=1)
            page=re.sub(r"\{\{#([-\w]+)\}\}",r"{#\1}",page)
            pages.append(page)
            clean_heading=re.sub(r"\{\{?#[^\}]+\}\}?", "", section["heading"]).strip()
            entries.append(dict(section,heading=clean_heading,source=source_reference,
                                level=2,position=0,lastModified=None,lastCommit=None,
                                codeSource=code_source,generated=True))
        if not pages:
            message=(
                "Não foi identificada declaração específica nesta extração. "
                "Isso não comprova ausência de funcionalidade, de contrato ou de testes."
            )
            if filename=="TESTES.md":
                message+=" Consulte [STATUS](STATUS.md), [Operação](OPERACAO.md) e [WBS](EVOLUCAO.md) para as evidências disponíveis."
            pages.append("## Evidência não verificada nesta camada\n\n"+message)
            entries.append(dict(level=2,heading="Evidência não verificada nesta camada",
                                markdown="## Evidência não verificada nesta camada\n\n"+message+"\n",
                                position=0,lastModified=None,lastCommit=None,
                                codeSource=code_source,generated=True))
        header=(f"# {uid} — {name} | {label}\n\n"
                f"> **Consulta isolada — {label}.** {description} "
                "Esta página é gerada de fontes versionadas, não editada diretamente.\n\n"
                "[Referência integral anterior](REFERENCIA-TECNICA.md) · "
                "[Especificação](ESCOPO.md) · "
                "[Propor atualização por assunto](../../standards/EDICAO-CONTEXTUAL.md)\n\n")
        output[filename]=(header+"\n\n".join(pages)+"\n",
                          {"source":source_reference,"revision":revision,"sections":entries})
    return output
