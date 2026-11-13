import { defineConfig } from "vitepress";
export default defineConfig({
  "lang": "pt-BR",
  "base": "/syndes-system/assets/experimentos/livros/a/",
  "title": "Syndes · Biblioteca A",
  "description": "Acervo técnico do Syndes",
  "themeConfig": {
    "nav": [
      {
        "text": "Biblioteca",
        "link": "/"
      },
      {
        "text": "Volumes",
        "items": [
          {
            "text": "Produto e módulos de negócio",
            "link": "/01-produto/p01"
          },
          {
            "text": "Plataforma e core",
            "link": "/02-plataforma/p14"
          },
          {
            "text": "Interfaces e aplicações",
            "link": "/03-interfaces/a01"
          },
          {
            "text": "Operação e negócios",
            "link": "/04-operacao/p06"
          },
          {
            "text": "Infraestrutura e qualidade",
            "link": "/05-infra-qualidade/i01"
          }
        ]
      }
    ],
    "sidebar": [
      {
        "text": "Produto e módulos de negócio",
        "collapsed": false,
        "items": [
          {
            "text": "P01 · CRM",
            "link": "/01-produto/p01"
          },
          {
            "text": "P02 · Inbox",
            "link": "/01-produto/p02"
          },
          {
            "text": "P03 · WhatsApp",
            "link": "/01-produto/p03"
          },
          {
            "text": "P04 · Organizations & Workforce",
            "link": "/01-produto/p04"
          },
          {
            "text": "P05 · Gestão de Atendimentos",
            "link": "/01-produto/p05"
          },
          {
            "text": "P07 · Scheduling",
            "link": "/01-produto/p07"
          },
          {
            "text": "P08 · AI Assistant",
            "link": "/01-produto/p08"
          },
          {
            "text": "P09 · Documents",
            "link": "/01-produto/p09"
          },
          {
            "text": "P10 · Email",
            "link": "/01-produto/p10"
          },
          {
            "text": "G02 · Produto e UX",
            "link": "/01-produto/g02"
          }
        ]
      },
      {
        "text": "Plataforma e core",
        "collapsed": true,
        "items": [
          {
            "text": "P14 · Platform Core",
            "link": "/02-plataforma/p14"
          },
          {
            "text": "A04 · Core Host",
            "link": "/02-plataforma/a04"
          },
          {
            "text": "A05 · Manager API",
            "link": "/02-plataforma/a05"
          },
          {
            "text": "A06 · Account Access API",
            "link": "/02-plataforma/a06"
          },
          {
            "text": "A08 · Core Kernel",
            "link": "/02-plataforma/a08"
          },
          {
            "text": "C01 · Control Plane",
            "link": "/02-plataforma/c01"
          },
          {
            "text": "C02 · Tenant Installer",
            "link": "/02-plataforma/c02"
          },
          {
            "text": "C03 · Identity Keycloak",
            "link": "/02-plataforma/c03"
          },
          {
            "text": "C04 · Authorization OpenFGA",
            "link": "/02-plataforma/c04"
          },
          {
            "text": "C05 · Secrets OpenBao",
            "link": "/02-plataforma/c05"
          },
          {
            "text": "C06 · Event Platform",
            "link": "/02-plataforma/c06"
          },
          {
            "text": "C07 · APIs e adapters",
            "link": "/02-plataforma/c07"
          },
          {
            "text": "C08 · Audit e observabilidade",
            "link": "/02-plataforma/c08"
          },
          {
            "text": "G01 · Arquitetura",
            "link": "/02-plataforma/g01"
          }
        ]
      },
      {
        "text": "Interfaces e aplicações",
        "collapsed": true,
        "items": [
          {
            "text": "A01 · Workspace Frontend",
            "link": "/03-interfaces/a01"
          },
          {
            "text": "A02 · Platform Manager Frontend",
            "link": "/03-interfaces/a02"
          },
          {
            "text": "A03 · Support Frontend",
            "link": "/03-interfaces/a03"
          },
          {
            "text": "A07 · Front Shared",
            "link": "/03-interfaces/a07"
          }
        ]
      },
      {
        "text": "Operação e negócios",
        "collapsed": true,
        "items": [
          {
            "text": "P06 · Syndes Support",
            "link": "/04-operacao/p06"
          },
          {
            "text": "P11 · Onboarding",
            "link": "/04-operacao/p11"
          },
          {
            "text": "P12 · Billing",
            "link": "/04-operacao/p12"
          },
          {
            "text": "P13 · Commercial Site",
            "link": "/04-operacao/p13"
          },
          {
            "text": "G05 · Operação e suporte",
            "link": "/04-operacao/g05"
          }
        ]
      },
      {
        "text": "Infraestrutura e qualidade",
        "collapsed": true,
        "items": [
          {
            "text": "I01 · DevServer01",
            "link": "/05-infra-qualidade/i01"
          },
          {
            "text": "I02 · Hospedagem e ambientes",
            "link": "/05-infra-qualidade/i02"
          },
          {
            "text": "I03 · win1-server",
            "link": "/05-infra-qualidade/i03"
          },
          {
            "text": "I04 · PostgreSQL",
            "link": "/05-infra-qualidade/i04"
          },
          {
            "text": "I05 · Docker e redes",
            "link": "/05-infra-qualidade/i05"
          },
          {
            "text": "I06 · Traefik HTTPS",
            "link": "/05-infra-qualidade/i06"
          },
          {
            "text": "I07 · Tailnet",
            "link": "/05-infra-qualidade/i07"
          },
          {
            "text": "I08 · Komodo",
            "link": "/05-infra-qualidade/i08"
          },
          {
            "text": "I09 · Whatsmeow runtime",
            "link": "/05-infra-qualidade/i09"
          },
          {
            "text": "I10 · Backup e Restore",
            "link": "/05-infra-qualidade/i10"
          },
          {
            "text": "I11 · Release e Rollback",
            "link": "/05-infra-qualidade/i11"
          },
          {
            "text": "I12 · Segurança de host",
            "link": "/05-infra-qualidade/i12"
          },
          {
            "text": "Q01 · Plataforma de testes",
            "link": "/05-infra-qualidade/q01"
          },
          {
            "text": "Q02 · Testes unitários",
            "link": "/05-infra-qualidade/q02"
          },
          {
            "text": "Q03 · Integração",
            "link": "/05-infra-qualidade/q03"
          },
          {
            "text": "Q04 · Browser E2E",
            "link": "/05-infra-qualidade/q04"
          },
          {
            "text": "Q05 · Segurança",
            "link": "/05-infra-qualidade/q05"
          },
          {
            "text": "Q06 · Performance",
            "link": "/05-infra-qualidade/q06"
          },
          {
            "text": "Q07 · CI/CD",
            "link": "/05-infra-qualidade/q07"
          },
          {
            "text": "Q08 · Release Engineering",
            "link": "/05-infra-qualidade/q08"
          },
          {
            "text": "Q09 · Infra Tests",
            "link": "/05-infra-qualidade/q09"
          },
          {
            "text": "Q10 · Quality Gates",
            "link": "/05-infra-qualidade/q10"
          },
          {
            "text": "G03 · Engenharia e Git",
            "link": "/05-infra-qualidade/g03"
          },
          {
            "text": "G04 · Privacidade",
            "link": "/05-infra-qualidade/g04"
          }
        ]
      }
    ],
    "outline": {
      "level": [
        2,
        3
      ],
      "label": "Nesta ficha"
    },
    "docFooter": {
      "prev": "Capítulo anterior",
      "next": "Próximo capítulo"
    },
    "search": {
      "provider": "local"
    },
    "socialLinks": [],
    "footer": {
      "message": "Experimento A · VitePress",
      "copyright": "Fontes técnicas versionadas"
    }
  }
});
