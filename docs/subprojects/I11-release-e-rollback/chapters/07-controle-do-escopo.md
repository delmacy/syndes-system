## 7. Controle do escopo
- Baseline: NÃO APROVADO.
- Alterações futuras: registrar impacto, dependências e aprovação antes de alterar o escopo.

---

## Auditoria I11 — riscos e exclusões (2026-11-14)

- Não declarar produção, deploy ou rollback bem-sucedido a partir de script versionado.
- Não ampliar rollback além do stack Manager e da rota 9447 sob controle do script.
- Não modificar banco, segredos, rotas alheias, CI ou outros owners nesta revisão documental.
- Escopo sem aceite formal comprovado; revisão e gates precedem integração.
