# Auditoria automática: código, contratos e documentação

> **Ferramentas de verificação, não homologação de produto.** A presença de um símbolo, endpoint, evento ou tabela no código não comprova exposição pública, implantação, compatibilidade, autorização ou uso em produção.

## Fontes de verdade e níveis de evidência

1. **Catálogo e status:** `docs/subprojects/index.json` lista as unidades; cada `STATUS.md` determina se há auditoria técnica parcial. `scripts/docs/audit_consistency.py` compara essas fontes com o plano de 57 linhas **sem números fixos nos testes**. Caso o catálogo cresça, a contagem é recalculada.
2. **Inventário automático de descoberta:** `scripts/docs/code_inventory.py` identifica declarações TypeScript, métodos, decorators, SQL e Go por análise **lexical** (melhor esforço). `scripts/docs/query_registry.py` permite pesquisar o inventário. Nenhuma dessas fontes prova contratos publicados.
3. **Extrator TypeScript por AST:** `scripts/docs/typescript_ast_inventory.mjs` utiliza o parser **TypeScript do próprio workspace**. Identifica declarações, métodos, modificadores `private/protected`, decorators NestJS e **literais candidatos** de eventos versionados, com arquivo e linha. Não faz typecheck, resolução de imports, análise de fluxo ou teste de runtime.
4. **Evidências verificáveis:** `docs/evidence/contract-witnesses.json` contém vínculos explícitos de **código → símbolo → documentação → proprietário**. `scripts/docs/source_evidence.py` acusa divergências. Novas entradas devem ser criadas quando uma auditoria aprovar uma afirmação específica, não para transformar toda declaração em API pública.
5. **Evidência operacional:** SQL aplicado, OIDC real, FGA, deployments, backup/restore, usuários, tenants e permissões só podem ser promovidos de estado após testes de ambiente e gates próprios.

## Comandos de verificação

```bash
# Checagem documental determinística, somente leitura
python3 scripts/docs/audit_consistency.py --check
python3 scripts/docs/source_evidence.py --json

# Busca de símbolos já existente
python3 scripts/docs/query_registry.py --module P01 --symbol CrmService --json

# AST, quando TypeScript estiver instalado nas dependências do workspace
node scripts/docs/typescript_ast_inventory.mjs apps/core-host/src/adapters.ts

# Validação dos witnesses usando AST (falha se o parser não estiver disponível)
python3 scripts/docs/source_evidence.py --ast --json

# Suíte automatizada que faz parte da validação documental atual
python3 -m unittest discover -s scripts/docs -p 'test_*.py' -q
```

Em uma worktree sem dependências Node instaladas, configurar `SYNDES_TYPESCRIPT_PACKAGE_JSON` como caminho do `package.json` de um workspace autorizado com TypeScript disponível, ou passar `--typescript-package-json` ao validador. Esse caminho **não deve ser versionado**. O modo AST falha se o parser não for encontrado: ele não faz fallback silencioso. Entradas JavaScript `.mjs` continuam com witness lexical e são reportadas como tal.

## Como tratar divergências

- **Arquivo ausente:** verificar se a referência migrou de owner; não atribuir nova responsabilidade por inferência.
- **Símbolo renomeado/removido:** localizar commit, revisar assinatura e consumidores. Atualizar a documentação **somente após** determinar se o contrato mudou.
- **Mudança de `public/private`:** revisar consumidores e compatibilidade de pacote antes de publicar como contrato.
- **Endpoint ou evento detectado:** marcar como *candidato*. Confirmar montagem no Host, versão, producer/consumer, autorização e testes.
- **Schema presente no Git:** não publicar `applied` sem ledger/consulta do banco de destino.
- **Mismatch de STATUS/plano:** atualizar a linha da unidade e a frase-resumo do plano conforme evidências; **nunca** mudar um STATUS só para passar em teste.

## Limites atuais / evolução proposta

O inventário geral não oferece prova semântica integral: há código JavaScript, Go, SQL, configurações distribuídas e consumers em owners diferentes. A validação por AST cobre TypeScript sob demanda; eventos são apenas literais candidatos e exigem revisão humana. Para ampliar cobertura, criar witnesses de APIs/eventos/schemas com casos negativos e, quando justificado, integrar parser AST ao pipeline CI da frente responsável **sem enfraquecer testes existentes**.

A revisão de documentação não altera runtime, migrações, services, authorization grants, pipelines Actions ou status do produto.
