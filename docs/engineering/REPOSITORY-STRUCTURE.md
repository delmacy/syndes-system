# Repository Structure

A estrutura atual é deliberadamente de governança e planejamento. O layout de código do monólito será criado somente após o technical handoff do Core CRM.

```text
/
├── AGENTS.md
├── README.md
├── docs/
│   ├── product/
│   └── engineering/
├── modules/
│   └── <module>/AGENTS.md
├── tests/
│   ├── AGENTS.md
│   ├── integrity/
│   ├── integration/
│   ├── security/
│   └── performance/
└── .github/
    └── workflows/
```

Regra: qualquer diretório de módulo em `modules/*` deve possuir `AGENTS.md`.
