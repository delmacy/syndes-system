# Catálogo de módulos e busca técnica

> **Consulta humana e por agentes.** Este índice combina identificador, área, caminho de código e ancoragens estáveis para descobrir stacks, classes/métodos, contratos públicos, frontend, tabelas e workpackages. As declarações são extraídas do código; **não são prova de runtime habilitado**.

## Encontre o módulo ou contrato

<div class="syndes-catalog" id="syndes-catalog">
  <div class="syndes-catalog-controls">
    <label for="syndes-catalog-search">Buscar módulo, ID, caminho ou tecnologia</label>
    <input id="syndes-catalog-search" type="search" placeholder="Ex.: P03, whatsapp, crm, infra/postgres" autocomplete="off" />
    <label for="syndes-catalog-area">Área</label>
    <select id="syndes-catalog-area">
      <option value="">Todas as áreas</option>
      <option value="produto">Produto e integrações</option>
      <option value="operacao">Operação e negócio</option>
      <option value="plataforma">Plataforma e Core</option>
      <option value="frontend">Frontends e experiência</option>
      <option value="infraestrutura">Infraestrutura e hospedagem</option>
      <option value="qualidade">Qualidade e testes</option>
    </select>
  </div>
  <p class="syndes-catalog-state" role="status">Preparando índice técnico…</p>
  <div class="syndes-catalog-results" aria-live="polite"></div>
</div>

## Acesso rápido por intenção {#busca-por-intencao}

- **Capabilities e histórias:** abra *Especificação* na ficha do módulo. Não trate requisito escrito como implementado.
- **Classes e métodos:** abra *Referência técnica → Inventário extraído do código*; cada declaração tem link para a linha da fonte.
- **Contrato público:** abra *Contratos declarados pelo pacote* e verifique `package.json#exports`, versão e owner.
- **Contrato privado:** abra *Classes e métodos*; um `export` de arquivo ou método TS `public` não autoriza import entre módulos.
- **Backend → frontend → banco:** use os atalhos HTTP, frontend e SQL; confira autorização e migrations aplicadas antes de homologação.
- **Planejamento e estado:** Evolução reúne WBS; Issues/Projects representam execução; Histórico reúne commits; STATUS e evidências representam integração e aceite.

## Índice para agentes {#indice-para-agentes}

O registro estruturado deste catálogo está em [`assets/catalog/modules.json`](https://delmacy.github.io/syndes-system/assets/catalog/modules.json). Ele contém ID, source, parent documental, links de cada seção e contagens da extração. O índice completo de cada módulo usa `assets/catalog/<ID>.json` com declarações e referências de linhas.

**Consulta determinística recomendada:** localizar o módulo por ID ou source no JSON; navegar à âncora adequada; validar o symbol no código pelo link, revisar exports e contratos; depois abrir o prompt de alteração ou implementação autorizado. Não executar uma mudança apenas por aparecer no índice.

## Fonte da documentação

[Modelo de fontes de verdade](../standards/FONTES-DE-VERDADE-E-RASTREABILIDADE.md) · [Padrão técnico](../standards/TEMPLATE-REFERENCIA-TECNICA.md) · [Linha do tempo](LINHA-DO-TEMPO.md)
