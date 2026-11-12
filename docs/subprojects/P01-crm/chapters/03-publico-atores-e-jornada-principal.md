## 3. Público, atores e jornada principal

| Ator | Necessidade | Autorização |
|---|---|---|
| Operador autorizado | Buscar, abrir ficha, criar notas e vincular contatos conforme escopo | JWT, membership, FGA por recurso |
| Administrador do tenant | Gerenciar cadastros e exportar conforme grants | Não implica permissão sobre outros tenants |
| Consumidor Inbox / WhatsApp | Relacionar identidade externa a pessoa canônica | Contrato e service grant verificado, não escrita arbitrária |
| Operador do Platform Manager | Administrar catálogo e entitlement | **Não recebe automaticamente acesso a dados CRM** |

### Jornada UC-01 — Cadastro e relacionamento

**Pré-condições:** tenant ativo e autorizado; módulo CRM efetivamente disponível/habilitado conforme gate aplicável; JWT verificado e papel com permissão de escrita.

1. Operador abre CRM no Workspace e consulta pessoas e organizações existentes.
2. Cadastra ou localiza uma organização de cadastro.
3. Cadastra ou localiza pessoa; se houver suspeita de duplicidade, recebe alerta sem mesclar automaticamente.
4. Relaciona pessoa e organização, adiciona tags e nota.
5. Consulta canais associados, histórico e vínculos.
6. Arquiva registro quando autorizado, preservando histórico e auditoria.
7. Exporta CSV quando tiver permissão.

**Falhas obrigatórias:** tenant errado, FGA negado/indisponível, contexto organizacional inválido, dados malformados, duplicidade de relacionamento, referência inexistente, falha de banco, requisição de CSV fora de limites.

**Pós-condições:** dados canônicos persistidos no banco correto, auditoria consistente, telas exibindo apenas operações autorizadas.

### Jornada UC-02 — Identidade observada em WhatsApp

**Pré-condições:** evento/contrato versionado entregue com escopo confiável e identidade verificável.

1. Contato externo é observado pelo fluxo WhatsApp/Inbox.
2. Política do CRM procura vínculo inequívoco dentro do escopo permitido (Platform Organization).
3. Quando inequívoco, publica `crm.person.resolved.v1`; quando ausente/ambíguo/conflitante, publica `crm.person.review_required.v1`.
4. Não cria pessoa provisória nem altera nomes confirmados sem procedimento aprovado.

**Limite atual:** política e testes sintéticos existem; workflow operacional de revisão de ambiguidades e escrita real não foi demonstrado como ativo.

---
