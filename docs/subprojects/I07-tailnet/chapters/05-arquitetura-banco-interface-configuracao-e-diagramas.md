## 5. Arquitetura, dados, schema e configuração

```text
JSON estruturado Tailscale Serve (stdin)
    -> check(config, mode, port, target)
    -> validação TCP/Web/Handlers/AllowFunnel
    -> PASS (exit 0) ou BLOCKED (exit 2)
```

Python 3 e biblioteca padrão. Não há SQL, migration, schema de banco, tela frontend ou API HTTP própria no artefato inspecionado. O proxy esperado `http://127.0.0.1:18085` é destino local, não prova de serviço ativo. Não registrar hostnames, tokens ou configuração real em páginas públicas.
