# Repository Structure

A estrutura atual combina governança/documentação com o scaffold inicial da API e o slice de registry do Control Plane. O comportamento do CRM e o frontend ainda aguardam os contratos de sessão/tenant/autorização.

```text
/
├── AGENTS.md
├── README.md
├── docs/
│   ├── product/
│   └── engineering/
│       └── tasks/PRD-001/
├── modules/
│   └── <module>/AGENTS.md
├── tests/
│   ├── integrity/
│   ├── integration/
│   ├── security/
│   └── performance/
├── apps/
│   ├── api/                  # NestJS; Platform Core registry slice + CoreCrmModule shell
│   │   ├── drizzle/          # reviewed Control Plane migrations
│   │   └── src/modules/
│   └── web/                  # Next.js; create after session/API contracts are frozen
└── .github/workflows/        # repository integrity + API CI
```

O diretório `apps/web/` acima é o destino planejado e ainda não foi criado.

Regra: qualquer diretório de módulo em `modules/*` deve possuir `AGENTS.md`.
