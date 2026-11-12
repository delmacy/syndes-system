## 2. Fronteiras e propriedade de dados

**O CRM é proprietário:** Person, Organization **de cadastro CRM**, vínculos Person↔Organization, Tag, Note, Timeline, EmployeeProfile enquanto perfil relacionado a Person e ChannelIdentity como referência externa.

**Não é proprietário:**
- `UserAccount`, usuários autenticados, issuer, tokens, permissões: Identity / Account Access / Core.
- Platform Organization, Organization operacional, Units, Workspaces, memberships e estrutura de equipe: **P04 Organizations & Workforce** e Control Plane. O termo `Organization` do CRM **não é** uma Platform Organization.
- Mensagens, estado de conversas, atribuições e filas: **P02 Inbox**.
- Sessões WhatsApp, mensagens do gateway, push names e receipts: **P03 WhatsApp**.
- Funis e protocolos de atendimento: **P05 Gestão de Atendimentos**.
- Conexões, segredos de banco e seleção de tenant: **Core Host / Tenant Database Provider**.
- Componentes visuais genéricos, tokens e sessões de frontend: **A07 Front Shared** e **A01 Workspace**.

**Invariantes:**
1. `Person != UserAccount`; `EmployeeProfile != Login`. Cadastro não concede identidade ou privilégio.
2. Nome confirmado no CRM não deve ser substituído silenciosamente por push name/business name externo.
3. Todo registro de negócio é isolado pelo tenant; escopo adicional de organization/workspace deve respeitar gates existentes, incluindo SQL002.
4. IDs e referências de outro tenant não revelam seus dados; FGA/membership passam antes de resolver banco.
5. Arquivar é operação de negócio; exclusão física exige procedimento específico e autorização.
6. Capabilities opcionais não se tornam pré-requisitos globais do CRM sem decisão explícita.
7. Inserção, alteração, vínculos e notas auditáveis precisam preservar a atomicidade da mutação e do registro correspondente.

---
