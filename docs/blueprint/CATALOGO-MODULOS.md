# Catálogo técnico por módulos

> **Um módulo, várias páginas técnicas independentes.** Pesquise pelo ID, nome, caminho, classe, método, tabela, rota declarada ou biblioteca. Ao escolher a camada, o catálogo abre **apenas a página correspondente** do módulo — APIs, dados, contratos, código ou dependências — sem deslocar o leitor para uma âncora de um documento misturado. Todas as referências derivam do código e da documentação versionada; nenhuma contagem representa homologação.

<div class="syndes-catalog" id="syndes-catalog">
  <div class="syndes-catalog-controls">
    <div class="syndes-field syndes-field-search">
      <label for="syndes-catalog-search">Buscar no inventário</label>
      <input id="syndes-catalog-search" type="search" placeholder="Ex.: P03, CrmService, crm_people, NestJS" autocomplete="off" />
    </div>
    <div class="syndes-field">
      <label for="syndes-catalog-area">Área responsável</label>
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
    <div class="syndes-field">
      <label for="syndes-catalog-layer">Camada de consulta</label>
      <select id="syndes-catalog-layer">
        <option value="dominio">Domínio e capacidades</option>
        <option value="dados">Banco, schemas e SQL</option>
        <option value="interfaces">Interfaces e aplicações</option>
        <option value="contratos">Contratos públicos</option>
        <option value="internos">Classes e métodos internos</option>
        <option value="apis">APIs HTTP registradas</option>
        <option value="dependencias">Dependências e stack</option>
        <option value="operacao">Operação e hospedagem</option>
        <option value="qualidade">Testes, status e evidências</option>
      </select>
    </div>
  </div>
  <div class="syndes-catalog-layer-summary" aria-live="polite">
    <h2 class="syndes-catalog-layer-title">Domínio e capacidades</h2>
    <p class="syndes-catalog-layer-note">Navegue pela especificação e pelos limites de responsabilidade de cada unidade.</p>
  </div>
  <label class="syndes-evidence-filter" for="syndes-catalog-evidence" hidden>
    <input id="syndes-catalog-evidence" type="checkbox" />
    Mostrar somente módulos com declarações encontradas nesta camada
  </label>
  <p class="syndes-catalog-state" role="status">Carregando registro técnico do snapshot publicado…</p>
  <div class="syndes-catalog-results"></div>
</div>

## Como interpretar a evidência

- **Domínio** corresponde a especificações e capabilities, não funcionalidades automaticamente concluídas.
- **Contratos públicos** são os entrypoints do manifesto `package.json#exports`; classes e métodos fora desses entrypoints continuam internos.
- **Banco** e **APIs** mostram somente SQL e decorators detectados no escopo varrido; migration aplicada, endpoint habilitado, autenticação e política tenant-safe exigem validação adicional.
- **Dependências** são bibliotecas declaradas no manifesto. Importações reais e dependências operacionais entre módulos requerem análise arquitetural.
- **Projetos e homologação** são acompanhados em [workpackages](PROJETO-E-WORKPACKAGES.md), [monitoramento](../monitoramento/README.md) e [histórico Git](LINHA-DO-TEMPO.md), não na contagem de símbolos.

## Índice estruturado para agentes {#indice-para-agentes}

A fonte de busca do portal é [`assets/catalog/modules.json`](https://delmacy.github.io/syndes-system/assets/catalog/modules.json). A evidência detalhada por unidade está em `assets/catalog/<ID>.json`, incluindo caminho de origem, linha do símbolo e revisão Git usada no build. Componentes documentais internos continuam consultáveis por ID, mas não aparecem duplicados como módulos principais.

Para contratos/eventos versionados do barramento, consulte [C06 — Event Platform](../subprojects/C06-event-platform/README.md). **Ainda não existe um inventário automatizado de eventos equivalente ao inventário HTTP**: não inferir produtores/consumidores.

[Mapa técnico das camadas](MAPA-TECNICO-POR-CAMADAS.md) · [Fontes de verdade e rastreabilidade](../standards/FONTES-DE-VERDADE-E-RASTREABILIDADE.md) · [Padrão de referência técnica](../standards/TEMPLATE-REFERENCIA-TECNICA.md)
