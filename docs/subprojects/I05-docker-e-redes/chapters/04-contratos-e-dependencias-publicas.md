## 4. Contratos e dependências públicas

O contrato do I05 é **declarativo**, não export TypeScript: Compose services, nomes de redes externas, volumes, mounts, `depends_on`, secrets e restrições de execução. Consumidores são workloads de I04, C03, C04, C05 e Manager. `openfga-migrate` é job de migração declarado; não executar como teste de documentação. Não há endpoint HTTP, evento de negócio, contrato de frontend ou migration SQL atribuível ao I05. Evidência de YAML não deve ser registrada como símbolo JavaScript fictício no witness registry.
