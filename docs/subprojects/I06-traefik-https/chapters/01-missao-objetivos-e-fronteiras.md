## 1. Missão, objetivos e fronteiras

- Missão técnica observada: encaminhar ingress HTTP aos serviços internos declarados por labels Docker/Traefik; o objetivo de HTTPS/Tailnet ainda requer prova de comportamento efetivo.
- Fronteira: I06 documenta ingress/proxy; **não** possui lógica de autenticação JWT, persistência ou eventos de CRM/Inbox/WhatsApp.
- Dependências relacionadas: I02 hospedagem, I05 Docker/redes e I07 Tailnet. Não presumir delegação de owner nem aceite operacional.
- Exclusões: alterações em certificados, firewall, rede, OpenFGA e deploy não integram esta atualização.
