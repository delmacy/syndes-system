#!/usr/bin/env python3
"""One-time human-first module homepages, preserving legacy agent source text."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[2]
UNITS=json.loads((ROOT/"docs/subprojects/index.json").read_text())["units"]
CANONICAL={u["id"]:u for u in json.loads((ROOT/"catalog/work-units.json").read_text())["units"]}
def create(u):
    uid=u["id"]
    name=u["name"]
    source=u["source"]
    kind="Componente técnico/histórico" if u.get("documentationParent") else "Unidade do catálogo Syndes"
    parent=u.get("documentationParent")
    parent_text=(f"- **Módulo pai:** [ {parent} — {CANONICAL[parent]['name']} ](../{Path(next(c['entry'] for c in UNITS if c['id']==parent)).parent.name}/README.md).\n"
                 if parent else "")
    return f"""# {uid} — {name}

> **{kind}.** Esta é a entrada humana do módulo: navegue pelas seis páginas abaixo. Código e documentação técnica podem existir sem estar implantados ou homologados.

<!-- syndes:module-id={uid};source={source};kind={'component' if parent else 'module'} -->

## Acessar a documentação {{#acessos}}

| Quero descobrir | Abrir |
|---|---|
| **O que o módulo faz?** | [Especificação, capacidades e histórias](ESCOPO.md) |
| **Como funciona do banco à interface?** | [Referência técnica: stack, classes e contratos](REFERENCIA-TECNICA.md) |
| **O que será feito?** | [Evolução: workpackages e dependências](EVOLUCAO.md) |
| **O que realmente mudou?** | [Histórico Git e evidências relacionadas](HISTORICO.md) |
| **Como testar, operar ou entregar?** | [Operação, testes, gates e runbooks](OPERACAO.md) |
| **Como pedir uma alteração?** | [Atualizações e propostas contextualizadas](updates/README.md) |

## Capacidades e requisitos {{#capacidades}}

Consulte a [especificação integral](ESCOPO.md) e os [capítulos de capacidades](chapters/03-capabilities.md) e [histórias/casos de uso](chapters/02-requisitos-historias-e-casos-de-uso.md). **O conteúdo da especificação define o que é aprovado; presença de um item na documentação não comprova implementação.**

## Stack, contratos e persistência {{#stack}}

A [referência técnica](REFERENCIA-TECNICA.md) lista exports de pacote, interfaces públicas, declarações internas de classes/métodos, APIs HTTP identificadas, candidatos de frontend e objetos SQL com origem verificável.

- **Fonte do código/artefato:** [`{source}`](https://github.com/delmacy/syndes-system/tree/main/{source}).
- **Banco de tenant e Control/Manager:** [seção de persistência da referência](REFERENCIA-TECNICA.md).
- **Contrato público vs. interno:** [referência técnica](REFERENCIA-TECNICA.md).
{parent_text.rstrip()}

## Planejamento, progresso e provas {{#evolucao}}

- [Workpackages, tasks e prioridades](EVOLUCAO.md).
- [STATUS — estado com evidências](STATUS.md) · [SPRINT — incremento](SPRINT.md).
- [Histórico de alterações por commit](HISTORICO.md).
- [GitHub Issues do repositório](https://github.com/delmacy/syndes-system/issues).

Não interpretar task cadastrada como tarefa concluída, nem commit como deploy.

## Para agentes e busca precisa {{#agentes}}

- **Identificador canônico:** `{uid}`.
- **Caminho deste arquivo:** `{u['entry']}`.
- **Fonte do módulo:** `{source}`.
- **Leitura por intenção:** requisito → `ESCOPO.md`; símbolo/API → `REFERENCIA-TECNICA.md`; tarefa → `EVOLUCAO.md`; evidência → `HISTORICO.md` ou `STATUS.md`.
- **Prompts disponíveis:** [projeção](PROJECAO.md), [implementação](IMPLEMENTACAO.md) e [alteração rápida](ALTERACAO.md).
- **Ancoragens fixas deste home:** `#acessos`, `#capacidades`, `#stack`, `#evolucao`, `#agentes`.

## Contexto legado do catálogo {{#contexto-legado}}

A seção abaixo preserva as instruções de localização anteriores. Ela não é a navegação principal para leitores humanos.

"""
def main():
    count=0
    for u in UNITS:
        path=ROOT/u["entry"]
        old=path.read_text(encoding="utf-8")
        if "<!-- syndes:module-id=" in old:continue
        heading,_,remainder=old.partition("\n")
        assert heading.startswith("# "),path
        new=create(u)+remainder.strip()+"\n"
        path.write_text(new,encoding="utf-8")
        count+=1
    print("Human-first module homepages created:",count)
if __name__=="__main__":main()
