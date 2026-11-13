## 1. Missão e fronteiras

O artefato auditado verifica, sem alterar o ambiente, se uma rota Tailscale Serve dedicada ao Platform Manager está livre ou se aponta exclusivamente ao serviço local esperado com HTTPS e sem Funnel público.

**Dentro da fonte:** análise de JSON estruturado, recusa de configuração inválida, comparação exata de destino, saída sem hostname. **Fora da prova:** configuração ativa, política ACL, certificado, tráfego real, autenticação do Manager e disponibilidade do serviço. A decisão de escopo completo de I07 continua pendente.
