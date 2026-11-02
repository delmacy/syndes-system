# Revisão visual do CRM — 2 de novembro de 2026

Capturas **reais do frontend React/Vite em Google Chrome**, usando dados demonstrativos e respostas de API/identidade simuladas, sem acesso a registros reais.

| Vista | Imagem |
| --- | --- |
| Ficha do contato — desktop ampliada (860px, duas colunas) | [Desktop](crm-ficha-desktop.jpg) |
| Ficha do contato — mobile 390px em tela inteira | [Mobile](crm-ficha-mobile.jpg) |
| Histórico/canais — desktop após rolagem | [Histórico](crm-historico-desktop.jpg) |
| Formulário de edição no novo layout | [Editar](crm-editar-contato.jpg) |

**Antes:** [capturas de 2026-11-01](https://github.com/delmacy/syndes-system/tree/review/crm-frontend-capturas-20261101/docs/reviews/crm-frontend-2026-11-01).

**Mudanças:** 860px de largura no desktop (antes ~384px), ficha 100vw no mobile (antes ~75%), formulários responsivos, cabeçalho fixo com fechamento acessível. Tests Chrome em 320px, 390px e 1440px, sem truncamento dos controles.

**Status:** somente ajuste de UX em branch de desenvolvimento. CRM e Inbox ainda exigem Product Gate real, não são lançamentos em produção.
