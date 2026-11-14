## 5. Arquitetura, banco, interface, configuração e diagramas
- Componentes, ownership de dados, migrations e autorização: A VERIFICAR.
- Nomes reais de variáveis de ambiente: A DOCUMENTAR, nunca incluir valores de segredos.
- Diagramas versionados: A ELABORAR se aplicáveis.

### Constatação estática — 2026-11-14
- Artefato identificado: `infra/master-admin/check-tailnet-route.py` (blob `d51f6e69f2b0a04670eaf7c7119950fa53da1452` em `main` `1cf48cc0`).
- A rotina `check(config, mode, port=9447, target="http://127.0.0.1:18085")` examina estrutura de configuração Tailscale Serve; não é servidor, banco, frontend ou provisionador.
- O contrato de configuração real e seus formatos alternativos exigem validação adicional; não inferir topologia implantada.
- Não foi identificada nesta revisão evidência de migrations, API de produto ou interface gráfica pertencentes ao verificador. Isso não equivale a declarar inexistência em todo o repositório.
