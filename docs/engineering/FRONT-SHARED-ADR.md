# ADR — Front-shared para Manager e Workspace

**Data:** 2026-11-09
**Estado:** Incremento implementado em branch isolada; não implantado, não integrado a `main`.
**Aplicações:** `apps/master-admin-web` (Control Plane) e `apps/workspace-web` (tenant Workspace).
**Decisão:** manter aplicações, autenticações e deploys separados, compartilhando **código de componentes visuais somente** por `packages/front-shared`.

## Problema observado

O Workspace já possui primitivos reutilizáveis em `src/components/ui`, mas o Manager contém elementos semelhantes implementados diretamente no `App.tsx`. Sem um package único, o produto acumularia correções e alterações visuais duplicadas, podendo divergir em comportamento, acessibilidade e responsividade.

## Escolha técnica

`@syndes/front-shared@0.1.0` é um package interno React com cinco implementações canônicas extraídas do Workspace: **Button, Input, Badge, Card (e subcomponentes), Separator**. As cópias originais do Workspace são **excluídas** e seus imports passam a apontar diretamente a `@syndes/front-shared/<componente>`. O Manager usa Button, Input, Badge e Card do **mesmo código**, com `unstyled` apenas para preservar suas classes e identidade atuais, sem recriar a lógica do componente. `unstyled` não altera renderização semântica nem autorização.

Os arquivos específicos `sidebar.tsx`, `dialog.tsx`, `sheet.tsx`, `tooltip.tsx`, `sonner.tsx` e demais ainda pertencem ao Workspace porque faltam validação de escopo, integração e consumo real pelo Manager. Eles devem ser avaliados **depois**, não copiados para dentro do Manager.

### Contrato de isolamento

- **Permitido:** componentes puros, classes/tokens, ícones, comportamentos de input, estados visual/loading/disabled, responsividade, acessibilidade, utilitários de composição.
- **Proibido no shared:** `Keycloak`, issuer/client ID, token/roles, `tenantId`/organização/workspace, chamadas `fetch`, `localStorage` de sessão, permissões OpenFGA, APIs CRM/Inbox/Support, navegação da aplicação, segredos, dados de cliente. Um componente recebe props comuns, nunca contexto de segurança.
- O Manager **continua com frontend/porta próprios** e API administrativa separada; o Workspace possui OIDC e infraestrutura próprios. Compartilhar React primitives **não** cria qualquer permissão cruzada.

### Gerenciamento de dependências

O monorepo ainda mantém instalação/lockfile independente por app, sem workspace raiz. Por isso, nesta fase, ambos consomem `@syndes/front-shared` por `file:../../packages/front-shared`; os `exports` apontam à fonte TSX, compatível com o Vite dos dois aplicativos. No checkout fresco do CI, o npm cria o link local, mas o TypeScript resolve tipos pelo caminho real de `packages/front-shared`, que inicialmente não possui `node_modules`. O script `scripts/ensure-installed.mjs`, executado automaticamente por `prebuild`/`predev` (e no preview), instala as dependências do pacote **somente se estiverem ausentes**. Não depende de uma instalação prévia na máquina. `react`, `react-dom` e `@base-ui/react` são **peerDependencies**, e Vite usa `resolve.dedupe` para impedir React duplicado mesmo quando existe `node_modules` em `packages/front-shared`. CSS Tailwind v4 de ambos escaneia o package via `@source`.

Foi identificado durante testes o erro `Cannot read properties of null (reading 'useRef')` ao carregar mais de uma cópia de React. A correção por `resolve.dedupe` foi verificada em Chromium na compilação real de preview.

O package é **interno e source-first**, não publicado em GitHub Packages nesta entrega. Antes de publicar, implementar build distribuível `dist`, testes em consumidor de pacote empacotado, controle de versões, `peerDependencies`, `npm pack` e release auditado; não publicar TSX do monorepo por acidente.

### Portabilidade e testes

- `packages/front-shared/test/source-contract.test.mjs`: prova que há apenas uma implementação por primitivo, proíbe import de segurança/tenancy e exige import do mesmo pacote nos dois frontends.
- `npm test` em **cada app** executa suas próprias regressões mais esse contrato compartilhado; sem modificar workflows de GitHub Actions gerenciados por outra frente.
- `npm run build` em ambos prova TypeScript, estilos Tailwind e bundling com React único; `npm run build:visual-preview` e `node tests/visual-preview-e2e.mjs` no Manager verificam interface, dois menus existentes, busca, filtro, detalhes e nenhuma chamada protegida.
- `npm run test:browser` do Manager com fixtures valida Keycloak + negação + logout no build autenticado.
- O Workspace preserva seus testes de tenant API/PKCE/Inbox/CRM e o smoke anônimo de navegação. Testes autenticados live exigem credenciais e são responsabilidade do ambiente de homologação, não devem usar senhas gravadas nos testes.

### Próximos passos autorizáveis

1. Reorganizar features do Manager, só depois da aprovação visual, **importando primitivos do front-shared**, sem clonar seus arquivos.
2. Ampliar o pacote somente quando o segundo consumidor precisar do componente; manter componentização e documentação no mesmo PR.
3. Solicitar à frente responsável por Actions a adição de `packages/front-shared/**` como gatilho dos workflows relevantes e, quando oportuno, uma matriz de builds do package. **Não alterar workflows neste trabalho**, conforme divisão de responsabilidades.
4. Definir tokens temáticos de marca para Manager e Workspace em pacote compartilhado quando os estilos estiverem estabilizados; não impor mudanças visuais arbitrárias agora.

### Build de imagem Docker do Manager

O job de imagem independente do Manager compila o frontend dentro do `apps/master-admin-web/Dockerfile`. O Dockerfile agora copia `packages/front-shared` no mesmo layout de monorepo **antes** do `npm ci`, executa o bootstrap pelo `prebuild` e produz o bundle em `/repo/apps/master-admin-web/dist`. A segunda etapa continua Nginx sem privilégios. Sem essa modificação, a dependência local `file:../../packages/front-shared` não existiria dentro do contexto da imagem.

O Dockerfile `Dockerfile.runtime` existente (que apenas instala um bundle já compilado) não foi alterado. Não há compartilhamento de hostnames, sessões, endpoints nem assets de tenant em runtime.
