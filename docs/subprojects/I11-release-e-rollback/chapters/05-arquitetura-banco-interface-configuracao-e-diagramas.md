## 5. Arquitetura, banco, interface, configuração e diagramas
- Componentes, ownership de dados, migrations e autorização: A VERIFICAR.
- Nomes reais de variáveis de ambiente: A DOCUMENTAR, nunca incluir valores de segredos.
- Diagramas versionados: A ELABORAR se aplicáveis.

---

## Auditoria I11 — arquitetura e efeitos

Fluxo textual: checkout permitido → dependências/DB/identidade/segredos → manifest CI e diff Git → Tailnet/issuer/porta → (preflight: sair) ou (apply: arquivos `/run`, builds, Compose, smoke HTTP local, Serve privado). O script consulta banco, mas não contém migration SQL. O rollback não restaura estado externo.
