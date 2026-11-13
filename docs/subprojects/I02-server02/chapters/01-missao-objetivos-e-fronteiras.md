## 1. Missão, objetivos e fronteiras

### Missão de I02 — Hospedagem por ambiente e função

Construir uma referência verificável de **onde e como o Syndes é executado, protegido, integrado e recuperado**, começando pelo DevServer01 e deixando staging/produção explicitamente **não verificados** até acesso e aceite. I02 coordena a visão do ambiente; não substitui os owners das stacks e serviços.

| Incluído no escopo documental | Fora desta auditoria |
|---|---|
| Mapear desenvolvimento, homologação e produção, com estados independentes | Declarar produção ativa só porque existe Compose ou DNS |
| Levantar inventário **somente leitura** de containers, imagens, redes, mounts e health | Subir/parar containers, abrir portas, reconfigurar proxy, limpar volumes |
| Vincular serviços aos manifests e responsáveis I01/I03/I04/I05–I08/I12 | Transferir controle de Core Host, Manager API, PostgreSQL e WhatsApp para I02 |
| Distinguir Control DB, tenant DB, stores técnicos e segredos | Executar migrations, consultar dados de tenants ou extrair secretos |
| Especificar dependências de rollout, backup, restore, rollback e acesso | Assinar homologação, Product Gate ou DR sem ensaio real |
| Registrar hosts sem torná-los módulos no menu | Publicar IPs, portas administrativas, rotas privadas ou credenciais |

### Princípios de arquitetura preservados

- **Ambiente** é a unidade de decisão operacional: desenvolvimento, staging e produção; servidor é recurso do ambiente. DevServer01 tem evidência de desenvolvimento. Os demais hosts não foram auditados.
- **Composição da hospedagem** usa Docker/Compose para os componentes observados; não há evidência de Kubernetes, cluster HA ou orquestração de produção aprovada neste inventário.
- **Tenancy:** um servidor PostgreSQL pode atender bancos isolados; Control, Keycloak e OpenFGA são databases distintos; cada tenant recebe DB próprio segundo o contrato de `infra/README.md`. OpenBao mantém volume Raft.
- **Segregação:** Manager API e Web têm Compose versionado e redes dedicadas, porém um frontend de preview observado **não prova Manager operacional** nem sua API instalada.
- **Ingress:** Traefik concentra entradas publicadas. Exposição de porta é fato de rede, **não** validação de TLS, autenticação, origem permitida, rate limit ou firewall.
- **Integridade:** containers “Up”, CI verde e arquivos presentes não comprovam saúde funcional, backup válido, release, reversão, governança ou prontidão comercial.

**Atores:** operadores autorizados, engenharia, segurança, QA e donos dos módulos. I02 não fornece API, pacote npm, módulo NestJS nem frontend SaaS.
