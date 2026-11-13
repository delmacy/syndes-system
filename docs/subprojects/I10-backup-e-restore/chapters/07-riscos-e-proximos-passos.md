# I10 — 07 | Riscos, lacunas e próximos passos

1. **Risco de falsa homologação:** `passed_synthetic_only` não comprova recuperação operacional.
2. **Dados e segredos:** nunca usar bancos operacionais ou publicar dumps, credenciais ou logs sensíveis.
3. **Fronteira de owners:** SQL de Control e tenant é referenciado, não gerenciado por I10.
4. **Gates:** revisar fixtures e código com owners; executar ensaio descartável autorizado; testar navegação/MkDocs/links/registry; registrar resultado por SHA; aprovar política de RPO/RTO separadamente.

WBS: `I10.DOC.01` parcial; `I10.TEST.01` pendente; `I10.OPS.01` bloqueado. [STATUS](../STATUS.md).
