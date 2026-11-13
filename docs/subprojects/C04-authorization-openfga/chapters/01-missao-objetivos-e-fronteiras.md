## 1. Missão, objetivos e fronteiras

C04 fornece a **decisão relacional de autorização** por OpenFGA. A autenticação JWT é de C03/consumidores, membership e catálogo de módulos são C01, o escopo Organization/Workspace é P04 e a entrega de eventos pertence a C06. C04 não é fonte canônica de pessoas CRM, mensagens ou banco tenant.

Tipos documentados: `user`, `tenant`, `resource`, `service`, `event_delivery`. Permissões de usuário (`can_read/can_write`) não autorizam serviço (`can_process`). Configurações reais/tuples não inspecionadas.
