## 7. Controle de escopo, riscos e próximos gates

**Escopo da presente atualização:** somente páginas/documentos da P14 e testes de regressão documental. Não se alteram `modules/platform-core/AGENTS.md`, `packages/core-kernel`, `apps/core-host`, Config de plugins, pipelines, schemas, grants, dados, servidores nem configuração operacional.

| Risco / divergência | Owner real | Encaminhamento |
|---|---|---|
| P14 confundido com serviço `platform-core` | P14/G01 | Declarar `AGENTS.md` como única fonte própria; Core real pertence a A08/A04 |
| Kernel público confundido com SDK npm publicado | A08 | `package.json` é `private:true` e exporta `"." `; release externo requer licença/revisão |
| Loader fixo confundido com perfil por instância | A04/Infra | CMP-02/03 ainda pendentes; não declarar dois perfis implantáveis |
| Serviço Basic presente em dependências, ausente do loader | A04/P05 | Não instalar/ativar Serviço sem preflight Control/FGA/migrations |
| `executeModule` confundido com enforcement de todas as rotas | A04/C01/C04 | Confirmar o gate em cada endpoint/worker, falha fechada |
| Event Bus opt-in confundido com scheduler operacional | A04/C06/Infra | Sem worker automático, source de Control, service grants/backup/restore e gate |
| Banco Control confundido com tenant data | C01/C02/I04 | Isolamento por database, schema, conexão pinned e owner por migration |
| Perfil com dois Hosts concorrentes | A04/C06/Infra | Ownership de eventos, inbounds e jobs antes de permitir múltiplos processos |
| Publicação Docs confundida com release | G03/Q07/Q10 | Status por SHA/CI/deploy/aceite distintos |

### Checklist

- [x] Fonte P14 e ausência de runtime próprio verificadas por árvore do Git.
- [x] API pública do Kernel e composição Host identificadas em código.
- [x] ADR/WBS de perfis reconciliadas com `config/modules.json` fixo.
- [x] CI do SHA auditado verificado como 24/24 success em ambiente GitHub Actions.
- [ ] CMP-01 validada formalmente por owners/consumer-tests — **PENDENTE**.
- [ ] Perfis CMP-02/03 disponíveis — **NÃO IMPLEMENTADOS**.
- [ ] Gate de worker/Control/tenant/restore e autorização operacional — **BLOQUEADO**.
- [ ] Product Gate/CI de rollout e aprovação da composição — **NÃO COMPROVADOS**.

**Não aumentar a contagem de auditorias parciais do programa:** P14 **já** estava contabilizado como auditoria parcial no plano anterior. Esta passagem amplia a evidência e substitui placeholders, sem promover P14 para DONE ou aumentar o total de 10 unidades auditadas.
