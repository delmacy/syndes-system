# APIs — catálogo e contratos

> **Consulta de APIs por evidências do código.** O catálogo lê decorators HTTP presentes no repositório, mas não comprova que as rotas estejam montadas, autorizadas ou publicadas no ambiente.

## Localizar endpoints {#localizar-endpoints}

[Explorar APIs por módulo](CATALOGO-MODULOS.md?camada=apis) · [Contratos públicos e limites de importação](../standards/CONTRATOS-PUBLICOS.md) · [Core Host](../subprojects/A04-core-host/REFERENCIA-TECNICA.md)

Pesquise pelo módulo responsável, selecione **APIs HTTP registradas** e consulte o arquivo e a linha do decorator. Para chamar uma API de forma segura, confirme a rota efetiva no Host, método HTTP, payload de entrada/saída, versionamento, autorização, identidade e isolamento por tenant.

## Onde encontrar o contrato de cada módulo {#contratos}

- **Referência técnica:** endpoints declarados, exports de pacote, classes e métodos rastreados até o código.
- **Especificação:** operações e capacidades esperadas do módulo, com contexto de domínio.
- **Operação e testes:** evidências de autorização, integração e runtime disponíveis quando verificadas.

A existência de um decorator ou de uma interface não autoriza acesso cruzado entre Platform Manager e tenant. APIs de controle e internas não devem ser apresentadas como rotas públicas somente por constarem no código.
