## 4. Contratos e dependências públicas
- Entradas, saídas, APIs, eventos e ports: A INVENTARIAR pela fonte executável.
- Dependências obrigatórias e opcionais: A VERIFICAR.
- Bibliotecas permitidas: consultar exports públicos e dependências existentes, sem copiar implementação privada.

---

## Auditoria I11 — fronteira contratual

Interface CLI Bash `--preflight|--apply` (padrão preflight); dependências externas Docker, jq, tailscale, python3, curl, git, PostgreSQL, Keycloak e OpenBao. As consultas SQL `pg_authid` e `platform_operator_access` são verificações internas da implantação, **não** novos contratos públicos ou autorização para alterar schema. Nenhum evento ou API HTTP pública é exposto pelo script.
