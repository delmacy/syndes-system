## 4. Contratos, APIs e dependências

**Função Python:** `check(config, mode, port=9447, target="http://127.0.0.1:18085") -> (bool, str)`.

**CLI:** `--mode free|active`, `--port` padrão 9447, `--target` restrito ao alvo fixo, JSON por stdin, códigos 0/2 e prefixos `PASS:`/`BLOCKED:`.

**Formato consumido:** `TCP`, `Web`, `Handlers`, `Proxy`, `AllowFunnel` da configuração estruturada Serve. Depende da compatibilidade desse formato; nenhuma API HTTP própria ou evento de domínio identificado no script. O middleware `syndes-tailnet-only@docker` de I06 não é definido por este arquivo.
