# WA-05-R2 — Preflight de Infraestrutura (Read-Only)

- **Data:** 2026-10-30
- **Natureza:** pré-gate, apenas leitura. Nenhum código, configuração, `.env`, segredo, serviço, estado do Git ou infraestrutura remota foi modificado.
- **Alvo:** configuração de banco de teste, CI de serviço e caminho de deploy privado server02/Tailscale do WhatsApp (PRD-003).
- **Decisão recomendada:** **BLOQUEADO** até resolução dos itens de infraestrutura listados na seção 5.

---

## 1. Por que CONTROL_PLANE_DATABASE_URL em 127.0.0.1:54331 autentica incorretamente

### Verificação de portas (read-only, sem credenciais)

Sondagem TCP local contra `127.0.0.1`:

| Porta | Resultado | Interpretação |
|-------|-----------|---------------|
| 54331 | conexão aceita | Servidor PostgreSQL escutando |
| 5433  | conexão aceita | Servidor PostgreSQL escutando |
| 5432  | conexão recusada | Nenhum servidor nesta porta |

### Estrutura da URL no `.env` local (valores ocultos)

Análise de estrutura sem imprimir usuário, senha ou URL completa:

| Variável | Presente no `.env` | Senha embutida na URL |
|----------|-------------------|----------------------|
| `CONTROL_PLANE_DATABASE_URL` | sim | **não** |
| `TENANT_ADMIN_DATABASE_URL` | sim | **não** |

### Causa raiz

A URL `CONTROL_PLANE_DATABASE_URL` do `.env` local usa o formato `postgresql://usuario@127.0.0.1:54331/banco` — **usuário sem senha** (ausente o segmento `:senha@`). O servidor PostgreSQL em `127.0.0.1:54331` exige autenticação SCRAM (challenge de senha). Como a URL não fornece senha, o driver `node-postgres` não consegue completar o handshake de autenticação e a conexão falha.

Isso difere da falha de "senha incorreta": aqui o problema é a **ausência do campo de senha na URL de conexão**, não uma senha errada. O servidor aceita a conexão TCP, mas rejeita a autenticação porque nenhuma credencial foi enviada.

### Comparação com a configuração de CI aprovada

O workflow `.github/workflows/api.yml` define:

- Serviço `postgres`: imagem `postgres:16`, variáveis `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, porta `5432:5432`, health check `pg_isready`.
- `CONTROL_PLANE_DATABASE_URL`: `postgresql://api_ci:api_ci_test_only@localhost:5432/control_plane`
- `TENANT_ADMIN_DATABASE_URL`: mesma estrutura

A credencial de CI é **demonstrabmente de teste** (a senha contém o marcador `test_only`) e o banco é **descartável** (serviço `postgres:16` criado por job e destruído ao final). No entanto, localmente a porta 5432 está com conexão recusada (não há servidor PostgreSQL rodando), portanto não é possível aplicar essa credencial localmente sem provisionar um serviço PostgreSQL.

---

## 2. Teste de integração PostgreSQL do WhatsApp — decisão

### Critério de execução

A tarefa exige: se uma credencial for demonstravamente de teste e o banco for descartável, rodar a suíte focada do WhatsApp com override de variável de ambiente apenas no processo atual; caso contrário, deixar bloqueado. Não rodar testes contra banco não verificado.

### Aplicação ao ambiente local

| Condição | Status | Motivo |
|----------|--------|--------|
| Credencial de teste disponível? | sim (CI) | `api_ci:api_ci_test_only` em `.github/workflows/api.yml` |
| Banco descartável? | sim (CI) | serviço `postgres:16` efêmero por job |
| Servidor PostgreSQL acessível localmente? | **não** | porta 5432 recusa conexão; portas 54331/5433 aceitam conexão mas o banco neles não foi verificado como descartável/adequado |
| Docker/psql/pg_isready disponível? | **não** | não estão no PATH; não é possível provisionar PostgreSQL localmente |
| Rodar `whatsapp.postgres.integration.spec.ts`? | **bloqueado** | não há servidor PostgreSQL verificável localmente; não se pode usar credencial de CI contra porta sem servidor; não se pode rodar contra banco não verificado (portas 54331/5433) |

### Comando que seria executado (quando o ambiente estiver disponível)

Diretório: `apps/api`

```sh
$env:CONTROL_PLANE_DATABASE_URL='postgresql://api_ci:api_ci_test_only@localhost:5432/control_plane'
$env:TENANT_ADMIN_DATABASE_URL='postgresql://api_ci:api_ci_test_only@localhost:5432/control_plane'
npx jest src/modules/whatsapp/whatsapp.postgres.integration.spec.ts --runInBand
```

Este comando **não foi executado** porque não há servidor PostgreSQL em `localhost:5432` neste ambiente. Execução apenas em CI ou após provisionamento local de PostgreSQL descartável.

---

## 3. Caminho de deploy privado server02/Tailscale (read-only)

### Arquivo de configuração do deploy

`compose.whatsapp.yaml` (raiz do repositório):

- Serviço `api`: define `WHATSAPP_ENABLED=true`, `WHATSAPP_PROVIDER=whatsmeow`, `WHATSAPP_WHATSMEOW_URL=http://127.0.0.1:19083`, `WHATSAPP_WEBHOOK_PATH=/api/v1/whatsapp/webhook`, `WHATSAPP_REQUEST_TIMEOUT_MS=10000`. Depende do serviço `whatsmeow`.
- Serviço `whatsmeow`: build a partir de `./services/whatsmeow` (Dockerfile), `container_name: syndes-crm-test-whatsmeow`, `network_mode: host`, `restart: unless-stopped`.
- Variáveis exigidas (`:?required`, falha se ausentes): `WHATSAPP_WHATSMEOW_TOKEN`, `WHATSAPP_WEBHOOK_TOKEN`, `WHATSAPP_STORE_DSN`.
- Bind do sidecar: `127.0.0.1:19083` (privado por padrão).
- `SYNDES_API_URL: http://127.0.0.1:18081`.

### Documentação de ambiente (PRD-003-WHATSAPP-ENV.md)

- Porta privada por padrão (`127.0.0.1:18083` para API, `127.0.0.1:19083` para sidecar).
- Para server02/Tailscale, o bind pode ser alterado para o endereço do tailnet, mantendo ACLs e firewall restritivos.
- Nenhum token, QR ou segredo de sessão deve ser colocado no `.env` sem o mecanismo de secrets aprovado.
- No deployment atual, o sidecar permanece em `127.0.0.1:19083` com `network_mode: host`; somente Web/API continuam acessíveis pelo Tailscale Serve.
- O banco de sessão deve ser dedicado e o role deve ter privilégio apenas nesse banco.

### Endereço server02/Tailscale

- A resolução do host no tailnet foi conferida; os nomes e endereços internos foram omitidos deste relatório.
- O tailnet é privado; não há exposição de porta pública.

### Pré-condições de acesso (read-only, sem segredos)

| Item | Status | Fonte |
|------|--------|-------|
| Acesso administrativo remoto | detalhes omitidos | deve usar somente o caminho privado Tailscale e o mecanismo de autenticação aprovado |
| Variáveis obrigatórias do deploy | não verificadas localmente | `WHATSAPP_WHATSMEOW_TOKEN`, `WHATSAPP_WEBHOOK_TOKEN`, `WHATSAPP_STORE_DSN` são `:?required` no compose |
| Porta pública exposta | não | deploy é privado no Tailscale; sem abertura de porta pública |

### Comando de deploy (informativo, não executado)

Não há script de deploy único no repositório. O caminho segue o `compose.whatsapp.yaml` com `docker compose` (ou equivalente), exigindo as três variáveis `:?required` acima definidas em um mecanismo de secrets aprovado, e o sidecar whatsmeow acessível em `127.0.0.1:19083`.

---

## 4. Comandos executados e resultados exatos

Todos os comandos abaixo foram executados localmente, sem alterar fonte, configuração, `.env`, segredos, serviços, Git ou infraestrutura remota.

| # | Diretório | Comando | Resultado |
|---|-----------|---------|-----------|
| 1 | raiz | `node -e "..."` (sondagem TCP 54331/5433/5432 em 127.0.0.1) | 54331: conexão aceita; 5433: conexão aceita; 5432: recusa de conexão |
| 2 | raiz | Análise de estrutura de `.env` (Node.js, valores ocultos) | `CONTROL_PLANE_DATABASE_URL` presente, sem senha na URL; `TENANT_ADMIN_DATABASE_URL` presente, sem senha na URL |
| 3 | raiz | Leitura de `.github/workflows/api.yml` | CI usa PostgreSQL:16 descartável na porta 5432 com credencial `api_ci:api_ci_test_only` (test-only) |
| 4 | raiz | Leitura de `compose.whatsapp.yaml` | Deploy: api + whatsmeow sidecar; 3 variáveis `:?required`; bind privado 127.0.0.1 |
| 5 | raiz | Leitura de `docs/engineering/PRD-003-WHATSAPP-ENV.md` | Configuração de ambiente WhatsApp; bind privado por padrão; host server02 restrito ao tailnet |

---

## 5. Bloqueios e itens pendentes

| Item | Status | Detalhe |
|------|--------|---------|
| Gate de integração PostgreSQL (WhatsApp) | ⏳ bloqueado | Não há servidor PostgreSQL acessível localmente (5432 recusa; 54331/5433 aceitam mas não verificados como descartáveis). Não há Docker/psql/pg_isready para provisionar localmente. |
| Credencial de teste para PostgreSQL local | ⏳ não aplicável | A credencial de CI (`api_ci:api_ci_test_only`) aponta para `localhost:5432`, que não tem servidor local. |
| Deploy privado server02/Tailscale | ⏳ pendente | Não executado neste escopo; exige as 3 variáveis `:?required` (`WHATSAPP_WHATSMEOW_TOKEN`, `WHATSAPP_WEBHOOK_TOKEN`, `WHATSAPP_STORE_DSN`) via mecanismo de secrets aprovado. |
| Product Gate (PRD-003, WA-05) | ⏳ não recomendado | Depende da resolução dos itens de infraestrutura acima e do aceite formal do coordenador. |

---

## 6. Conclusão e recomendação

**Recomendação: NÃO ACEITO (pendente de infraestrutura)**

O motivo do bloqueio é exclusivamente de infraestrutura, não de código:

1. `CONTROL_PLANE_DATABASE_URL` no `.env` local omite a senha na URL de conexão, impossibilitando autenticação SCRAM contra o PostgreSQL em `127.0.0.1:54331`.
2. Não há servidor PostgreSQL local na porta 5432 (alvo da credencial de CI), e não há Docker/psql/pg_isready para provisionar um descartável localmente.
3. O teste de integração PostgreSQL do WhatsApp (`whatsapp.postgres.integration.spec.ts`) permanece **não executado** localmente; será executado em CI ou após provisionamento de banco descartável.
4. O deploy privado em server02/Tailscale segue o `compose.whatsapp.yaml` e permanece pendente, aguardando as variáveis de secrets obrigatórias e o aceite do coordenador.

Após a resolução dos itens de infraestrutura (PostgreSQL descartável disponível e secrets de deploy configurados), o private deployment pode prosseguir após Product Gate acceptance. Nenhum código foi alterado, nenhum commit/push/deploy foi realizado.

**Este relatório não concede aceite final.** O coordenador deve revisar as evidências e decidir sobre o gate.
