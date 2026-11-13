## 3. Capacidades observáveis na fonte

- `free`: identificar se porta HTTPS dedicada está desocupada.
- `active`: validar unicidade da rota, `HTTPS is True`, único handler `/`, proxy exato e ausência de Funnel público.
- Falha fechada com saída CLI 2; nenhuma alteração de configuração.
- O verificador não imprime hostname Tailnet.

**Não comprovado:** Tailscale ativo, TLS funcional, ACL aplicada, Manager disponível ou integração com Traefik. A fonte não representa uma solução completa de segurança de perímetro.
