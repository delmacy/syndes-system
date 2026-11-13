## 4. Contratos e dependências públicas

- Router `syndes-core-whatsapp-v2`: Host e prefixos `/v1/`/`/modules/`, prioridade 110, `web`, upstream interno 8082.
- Router `syndes-workspace-whatsapp-v2`: Host sem prefixo, prioridade 2, `web`, upstream 80.
- Ambos referenciam `syndes-tailnet-only@docker` e `infra-proxy`, exigindo middleware/provider/rede já existentes.
- **Não declarar contrato HTTPS ativo apenas pelo nome I06**; nenhum evento versionado, SDK ou API de negócio I06 identificado.
- Origem: `modules/whatsapp/deploy/devserver01-cutover.compose.yaml`; detalhamento em [Referência técnica](../REFERENCIA-TECNICA.md).
