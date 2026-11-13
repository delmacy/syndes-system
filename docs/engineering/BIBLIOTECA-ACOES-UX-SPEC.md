# Biblioteca Syndes — organização orientada a ações (Direção Visual 02)

Status: **especificação de organização aprovada; interface não homologada**.

## Objetivo

Oferecer documentação operacional e técnica densa, mas progressiva, sem criar uma página contínua e interminável por módulo. Cada módulo deve apresentar contexto sucinto e ações navegáveis, onde contratos, dependências e evidências são agrupados pelo trabalho que realizam. Preservar o catálogo e os nomes reais do repositório; nenhuma interface ou funcionalidade planejada deve ser apresentada como implementada.

## Navegação em três níveis

1. **Biblioteca / Domínios**: Core, Produto, Frontends, Plataforma, Infraestrutura e Qualidade. Usar o catálogo de ownership como fonte, não duplicar módulos.
2. **Módulo**: identidade, responsabilidade, owner, criticidade, maturidade e resumo de integração. Abaixo, índice pesquisável de **ações/capacidades**, não documentação integral em rolagem.
3. **Ação**: uma unidade funcional coesa; no cabeçalho, propósito, estado, entradas, saídas e consumidores; nas abas independentes, informação detalhada.

### Cabeçalho compacto por módulo

- Nome/ID canônico e domínio.
- Propósito de uma frase e fronteira de responsabilidade.
- Estado discriminado em **planejado / código presente / integrado / testado / homologado / operacional** (não reduzir a um único “concluído”).
- Responsável, dependências e vínculos para código, testes, decisões e tarefas.
- Índice de ações com rótulo, descrição curta e estado; filtro por ação/status.

### Estrutura de uma ação

Ordem recomendada dos blocos visíveis:
1. **Resumo** — o que executa, por quem, qual gatilho, pré-condições e resultado esperado.
2. **Fluxo** — passos e exceções; distinguir caminho síncrono e assíncrono.
3. **Contratos** — públicos/privados, comandos, queries, eventos consumidos e publicados, exemplos versionados.
4. **Dados** — entidades, tabelas/schema, ownership, persistência, tenant scope, validação e retenção.
5. **Implementação** — API/endpoints, classes/services, funções, código e diretórios existentes.
6. **Segurança** — identidade, permissões, políticas, isolamento multi-tenant e auditoria.
7. **Qualidade** — testes relevantes, resultados verificáveis, cobertura e evidências.
8. **Operação** — configuração, infraestrutura, observabilidade, falhas, reprocessamento e runbook.
9. **Pendências** — bloqueios, decisões abertas, WBS/issues e próximo critério de aceite.

As abas são **visões mutuamente exclusivas**, não âncoras para rolagem. As seções devem filtrar o conteúdo pela categoria. Uma aba sem conteúdo mostra “não documentado” e encaminha para a pendência correspondente; jamais inventar implementação.

## Exemplo de decomposição: CRM

As ações são exemplos de classificação, não confirmação de disponibilidade:

- **Cadastrar contato** — criar/editar, validar dados, deduplicar, registrar origem e identidade.
- **Consultar e localizar contato** — busca, filtros, permissões e vínculos.
- **Vincular atendimento** — associar conversas/interações ao contato.
- **Gerenciar etapas e funil** — somente se efetivamente previsto/documentado no módulo; caso contrário POST-MVP ou pendente.
- **Publicar alterações** — evento versionado com outbox e consumidores idempotentes, se houver implementação demonstrável.

Cada uma recebe suas próprias abas Contratos, Dados, API, Segurança, Testes e Pendências; os contratos compartilhados permanecem referenciados, não copiados.

## Regras de densidade e foco do agente

- Mostrar primeiro a **decisão funcional**; detalhes técnicos em segunda camada; payloads/código longos em expansão explícita.
- Resumo de cada ação até aproximadamente 5 linhas; metadados estruturados em chips discretos ou tabela pequena.
- Um status nunca pode ser inferido de outro. **IMPLEMENTED != INTEGRATED != TESTED != PROVEN != DONE**.
- Toda afirmação técnica deve apontar evidência verificável (arquivo/símbolo, teste, migration, contrato, issue ou ADR). Dado não verificado = “a confirmar”.
- Registrar `source_path`, `source_ref`, `last_verified_at` e `evidence` quando possível.
- No modo agente, gerar um **pacote de contexto da ação selecionada**: objetivo, escopo permitido, contratos, caminhos existentes, dependências, invariantes, testes, critérios de aceite e restrições; excluir ruído de outras ações.
- Não duplicar semântica em Markdown/HTML/XML. **Dados estruturados são fonte canônica**; interface renderiza as visões e Markdown pode servir como corpo explicativo.
- Não executar mudanças de escopo, publicar contratos, mudar estados ou fazer deploy apenas porque um campo da documentação descreve a intenção.

## Esquema conceitual

```ts
type Maturity = 'planned' | 'coded' | 'integrated' | 'tested' | 'proven' | 'operational';
type ActionDoc = {
  id: string; moduleId: string; title: string; intent: string;
  trigger?: string; prerequisites?: string[]; outputs?: string[];
  maturity: Maturity[]; owner?: string;
  contracts?: { public?: string[]; private?: string[]; commands?: string[]; events?: string[] };
  data?: string[]; implementation?: string[]; security?: string[];
  tests?: string[]; operations?: string[]; openItems?: string[];
  evidence?: { type: string; reference: string; verifiedAt?: string }[];
};
```

## Execução segura e critérios de aceite

1. Inventariar páginas e fontes da Biblioteca em uso; mapear todas as seções atuais para a nova taxonomia **sem excluir conteúdo**.
2. Introduzir índice de ações por módulo e dados estruturados com IDs estáveis; usar inicialmente apenas ações confirmadas no catálogo/código.
3. Implementar navegação exclusiva por aba na página da ação, com estado preservado ao trocar de ação/módulo.
4. Integrar filtros e links de evidência com fallback “não documentado”.
5. Implementar pacote contextual para agente, sem inventar recursos, classes ou endpoints.
6. Testar roteamento, isolamento entre abas, ausência de perda de conteúdo, referências quebradas e representação fiel dos estados.
7. Validar prévia de desenvolvimento e então seguir procedimento de publicação aprovado.

**Critério de conclusão:** um leitor encontra uma ação em no máximo três níveis, vê seu propósito e estado sem rolar páginas extensas, abre apenas a categoria desejada e consegue rastrear cada contrato/status até uma evidência. A implementação visual e o deploy devem ser validados separadamente deste documento.
