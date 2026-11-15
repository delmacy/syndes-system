## 4. Contratos e dependências públicas
- Entradas, saídas, APIs, eventos e ports: A INVENTARIAR pela fonte executável.
- Dependências obrigatórias e opcionais: A VERIFICAR.
- Bibliotecas permitidas: consultar exports públicos e dependências existentes, sem copiar implementação privada.

## Contrato de execução observado

CLI: `--mode` obrigatório (`free|active`), `--port` inteiro com padrão 9447 e `--target` com padrão fixo `http://127.0.0.1:18085`. Entrada JSON pela stdin; `check()` retorna `(bool, str)` e `main()` usa saída 0/2. Dependência externa: formato de configuração Tailscale Serve, cuja compatibilidade real não foi demonstrada. Não classificar a função Python interna como API pública versionada.
