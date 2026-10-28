import Link from "next/link";
import styles from "./commercial.module.css";
import { commercialSite } from "@/modules/commercial-site/site-config";

type IconName =
  | "users"
  | "message"
  | "inbox"
  | "calendar"
  | "sparkles"
  | "file"
  | "clock"
  | "check"
  | "headset";

function Icon({ name, className }: { name: IconName; className?: string }) {
  const common = {
    className,
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "users":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "message":
      return (
        <svg {...common}>
          <path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.7-5.1A8 8 0 1 1 21 15Z" />
          <path d="M8 10h8M8 14h5" />
        </svg>
      );
    case "inbox":
      return (
        <svg {...common}>
          <path d="M4 4h16v13H4z" />
          <path d="M4 13h4l2 3h4l2-3h4" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </svg>
      );
    case "sparkles":
      return (
        <svg {...common}>
          <path d="m12 3 1.2 3.2L16 7.5l-2.8 1.3L12 12l-1.2-3.2L8 7.5l2.8-1.3L12 3Z" />
          <path d="m18.5 13 1 2.3L22 16.5l-2.5 1.2-1 2.3-1-2.3-2.5-1.2 2.5-1.2 1-2.3ZM5 13l.8 2 2.2 1-2.2 1L5 19l-.8-2L2 16l2.2-1L5 13Z" />
        </svg>
      );
    case "file":
      return (
        <svg {...common}>
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M14 3v5h5M9 13h6M9 17h6" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.5 2.5L16 9" />
        </svg>
      );
    case "headset":
      return (
        <svg {...common}>
          <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
          <path d="M4 14a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2v-2ZM20 14a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2v-2ZM17 18c0 2-2 3-5 3" />
        </svg>
      );
  }
}

const features: Array<{ title: string; text: string; icon: IconName }> = [
  {
    title: "Clientes organizados",
    text: "Pessoas, empresas, contatos, histórico e contexto reunidos para a equipe encontrar o que precisa.",
    icon: "users",
  },
  {
    title: "WhatsApp no atendimento",
    text: "Um número no Basic, conectado ao fluxo de atendimento da empresa em vez de ficar isolado em aparelhos.",
    icon: "message",
  },
  {
    title: "Inbox compartilhada",
    text: "Conversas em um só lugar para acompanhar, assumir e continuar atendimentos com contexto.",
    icon: "inbox",
  },
  {
    title: "Agenda operacional",
    text: "Organize disponibilidade, compromissos, reagendamentos, cancelamentos e lembretes.",
    icon: "calendar",
  },
  {
    title: "Assistente digital N1",
    text: "Tira dúvidas, faz triagem, entende áudio, organiza contexto, agenda e chama uma pessoa quando necessário.",
    icon: "sparkles",
  },
  {
    title: "Documentos e e-mail",
    text: "Mantenha documentos relacionados ao cliente e uma caixa de e-mail integrada ao atendimento.",
    icon: "file",
  },
];

const steps = [
  {
    number: "01",
    title: "A mensagem chega",
    text: "O atendimento entra pelo canal conectado e é associado ao cliente certo.",
  },
  {
    number: "02",
    title: "O contexto acompanha",
    text: "Cadastro, conversa, notas e compromissos ficam disponíveis para quem vai atender.",
  },
  {
    number: "03",
    title: "IA ou pessoa continua",
    text: "A assistente resolve o primeiro nível e transfere para a equipe quando o caso exige atenção humana.",
  },
];

const included = [
  "Core CRM para clientes e empresas",
  "Inbox compartilhada",
  "1 número de WhatsApp",
  "Agenda e compromissos",
  "Assistente digital de primeiro nível",
  "Leitura e transcrição de áudio",
  "Documentos",
  "1 caixa de e-mail",
  "Até 3 usuários inicialmente",
];

export default function CommercialHomePage() {
  return (
    <main className={styles.site}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label={commercialSite.brandName}>
          <span className={styles.brandMark}>{commercialSite.brandMark}</span>
          <span>{commercialSite.brandName}</span>
        </Link>

        <nav className={styles.nav} aria-label="Navegação principal">
          <a href="#como-funciona">Como funciona</a>
          <a href="#recursos">Recursos</a>
          <a href="#preco">Preço</a>
        </nav>

        <Link className={styles.loginLink} href="/crm">
          Entrar
        </Link>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.status}>
            <span />
            {commercialSite.stage}
          </div>

          <p className={styles.kicker}>Atendimento e organização para pequenas empresas</p>
          <h1>
            Seus clientes, conversas e agenda.
            <span> No mesmo lugar.</span>
          </h1>
          <p className={styles.heroText}>
            Organize o atendimento que hoje fica espalhado entre WhatsApp,
            planilhas, agenda e memória. A {commercialSite.brandName} reúne o
            contexto da empresa e coloca uma assistente digital na linha de
            frente do atendimento.
          </p>

          <div className={styles.heroActions}>
            <a className={styles.primaryAction} href="#preco">
              Conhecer o Basic
            </a>
            <a className={styles.secondaryAction} href="#como-funciona">
              Ver como funciona
            </a>
          </div>

          <div className={styles.heroNotes}>
            <span>Sem plano anual obrigatório</span>
            <span>1 WhatsApp no Basic</span>
            <span>IA N1 incluída</span>
          </div>
        </div>

        <div className={styles.heroVisual} aria-label="Exemplo visual do atendimento">
          <div className={styles.appWindow}>
            <div className={styles.windowTop}>
              <div className={styles.windowBrand}>
                <span className={styles.miniMark}>{commercialSite.brandMark}</span>
                <div>
                  <strong>Atendimento</strong>
                  <small>Visão da equipe</small>
                </div>
              </div>
              <span className={styles.online}>Online</span>
            </div>

            <div className={styles.appBody}>
              <aside className={styles.conversationList}>
                <span className={styles.fakeSearch}>Buscar conversa</span>
                <div className={styles.activeConversation}>
                  <div className={styles.avatar}>MC</div>
                  <div>
                    <strong>Mariana Costa</strong>
                    <small>Quero remarcar para amanhã...</small>
                  </div>
                  <time>10:42</time>
                </div>
                <div className={styles.conversation}>
                  <div className={styles.avatarAlt}>RL</div>
                  <div>
                    <strong>Rafael Lima</strong>
                    <small>Vocês atendem sábado?</small>
                  </div>
                </div>
                <div className={styles.conversation}>
                  <div className={styles.avatarThird}>AS</div>
                  <div>
                    <strong>Ana Souza</strong>
                    <small>Obrigado pelo atendimento!</small>
                  </div>
                </div>
              </aside>

              <div className={styles.chat}>
                <div className={styles.chatHeader}>
                  <div>
                    <strong>Mariana Costa</strong>
                    <small>Cliente · WhatsApp</small>
                  </div>
                  <span>Contexto completo</span>
                </div>

                <div className={styles.messages}>
                  <div className={styles.customerMessage}>
                    Oi! Preciso remarcar meu horário de amanhã.
                  </div>
                  <div className={styles.typingIndicator} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className={styles.assistantMessage}>
                    <small>Assistente digital</small>
                    Claro. Posso verificar os horários disponíveis e fazer a
                    remarcação para você.
                  </div>
                  <div className={styles.contextCard}>
                    <span>Próximo compromisso</span>
                    <strong>Quarta-feira · 14:30</strong>
                    <small>Responsável: Atendimento 02</small>
                  </div>
                </div>

                <div className={styles.composer}>Responder atendimento…</div>
              </div>
            </div>
          </div>

          <div className={styles.floatingCard}>
            <span className={styles.floatingIcon}>✓</span>
            <div>
              <strong>Cliente identificado</strong>
              <small>Histórico e agenda disponíveis</small>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.problemStrip}>
        <p>Menos troca de abas.</p>
        <p>Menos informação perdida.</p>
        <p>Mais contexto para atender.</p>
      </section>

      <section className={styles.section} id="como-funciona">
        <div className={styles.sectionHeading}>
          <p className={styles.kicker}>Como funciona</p>
          <h2>O atendimento continua simples. A organização muda.</h2>
          <p>
            A empresa continua falando com seus clientes pelos canais de sempre,
            mas a informação deixa de depender de uma pessoa lembrar onde cada
            coisa ficou.
          </p>
        </div>

        <div className={styles.steps}>
          {steps.map((step) => (
            <article className={styles.stepCard} key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.sectionAlt} id="recursos">
        <div className={styles.sectionHeading}>
          <p className={styles.kicker}>Basic</p>
          <h2>O essencial para organizar atendimento e relacionamento.</h2>
          <p>
            Sem transformar uma pequena empresa em operadora de um sistema
            complexo. O foco do MVP é centralizar o trabalho que já acontece no
            dia a dia.
          </p>
        </div>

        <div className={styles.featureGrid}>
          {features.map((feature) => (
            <article className={styles.featureCard} key={feature.title}>
              <span className={styles.featureIcon}>
                <Icon name={feature.icon} className={styles.featureIconSvg} />
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.scheduleShowcase} id="agenda">
        <div className={styles.scheduleCopy}>
          <p className={styles.kicker}>Agenda operacional</p>
          <h2>Verifique seus compromissos e atendimentos marcados.</h2>
          <p>
            Abra a agenda da equipe e veja rapidamente o que está marcado,
            quem vai atender e em qual horário. O mesmo contexto usado no
            atendimento acompanha o compromisso.
          </p>

          <div className={styles.scheduleBenefits}>
            <span>
              <Icon name="calendar" className={styles.benefitIcon} />
              Visão mensal
            </span>
            <span>
              <Icon name="clock" className={styles.benefitIcon} />
              Horários organizados
            </span>
            <span>
              <Icon name="users" className={styles.benefitIcon} />
              Responsável visível
            </span>
          </div>
        </div>

        <div className={styles.scheduleDemo} aria-label="Demonstração animada da agenda">
          <div className={styles.scheduleWindow}>
            <div className={styles.scheduleTopbar}>
              <div className={styles.scheduleBrand}>
                <span className={styles.miniMark}>{commercialSite.brandMark}</span>
                <div>
                  <strong>Central de trabalho</strong>
                  <small>Hoje · 27 de outubro</small>
                </div>
              </div>
              <span className={styles.scheduleStatus}>
                <Icon name="check" className={styles.scheduleStatusIcon} />
                Sincronizado
              </span>
            </div>

            <div className={styles.scheduleTabs}>
              <button className={styles.scheduleTabInbox} type="button">
                <Icon name="headset" className={styles.tabIcon} />
                Atendimentos
              </button>
              <button className={styles.scheduleTabCalendar} type="button">
                <Icon name="calendar" className={styles.tabIcon} />
                Agendamentos
              </button>
            </div>

            <div className={styles.scheduleStage}>
              <div className={styles.scheduleInboxView}>
                <div className={styles.scheduleInboxHeader}>
                  <span>Atendimentos em andamento</span>
                  <small>3 ativos</small>
                </div>
                <div className={styles.scheduleInboxRow}>
                  <span className={styles.scheduleAvatar}>MC</span>
                  <div>
                    <strong>Mariana Costa</strong>
                    <small>Remarcação confirmada</small>
                  </div>
                  <time>14:30</time>
                </div>
                <div className={styles.scheduleInboxRow}>
                  <span className={styles.scheduleAvatarAlt}>RL</span>
                  <div>
                    <strong>Rafael Lima</strong>
                    <small>Aguardando atendimento</small>
                  </div>
                  <time>15:00</time>
                </div>
              </div>

              <div className={styles.calendarView}>
                <div className={styles.calendarToolbar}>
                  <div>
                    <strong>Outubro 2026</strong>
                    <small>Agenda da equipe</small>
                  </div>
                  <div className={styles.calendarLegend}>
                    <span><i className={styles.legendGreen} /> Confirmado</span>
                    <span><i className={styles.legendGold} /> Aguardando</span>
                  </div>
                </div>

                <div className={styles.calendarGrid}>
                  {["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"].map((day) => (
                    <span className={styles.calendarWeekday} key={day}>{day}</span>
                  ))}

                  {[26, 27, 28, 29, 30, 31, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((day, index) => (
                    <div
                      className={
                        day === 27
                          ? styles.calendarDayActive
                          : index < 6
                            ? styles.calendarDayMuted
                            : styles.calendarDay
                      }
                      key={`${day}-${index}`}
                    >
                      <span>{day}</span>
                      {day === 27 && (
                        <>
                          <div className={styles.appointmentGreen}>
                            <strong>14:30</strong>
                            <small>Mariana Costa</small>
                          </div>
                          <div className={styles.appointmentGold}>
                            <strong>16:00</strong>
                            <small>Rafael Lima</small>
                          </div>
                        </>
                      )}
                      {day === 28 && (
                        <div className={styles.appointmentGreenMini}>09:00 · Ana</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <span className={styles.demoCursor} aria-hidden="true">
                <svg viewBox="0 0 24 24" width="28" height="28">
                  <path
                    d="M5 3.5 18.5 13l-6.2 1.2 3.1 5.1-2.5 1.5-3.1-5.1L6 20.5 5 3.5Z"
                    fill="currentColor"
                    stroke="#0a0f0a"
                    strokeWidth="1.2"
                  />
                </svg>
                <i />
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.aiSection}>
        <div className={styles.aiCopy}>
          <p className={styles.kicker}>Assistente digital</p>
          <h2>IA para atender primeiro. Pessoas para assumir quando importa.</h2>
          <p>
            A assistente se apresenta claramente como digital. Ela usa apenas as
            informações que a empresa disponibilizou para atendimento e atua
            dentro das funções autorizadas.
          </p>
          <ul>
            <li>Tira dúvidas e consulta FAQ.</li>
            <li>Faz triagem e entende mensagens de áudio.</li>
            <li>Agenda, remarca e cancela compromissos.</li>
            <li>Transfere para humano com resumo e contexto.</li>
          </ul>
        </div>

        <div className={styles.aiQuote}>
          <span>Exemplo de abertura</span>
          <blockquote>
            “Olá! Sou a assistente digital da empresa. Posso ajudar com dúvidas,
            agendamentos, remarcações ou cancelamentos. Se precisar, também
            encaminho seu atendimento para uma pessoa da equipe.”
          </blockquote>
          <small>Transparência faz parte do produto.</small>
        </div>
      </section>

      <section className={styles.pricingSection} id="preco">
        <div className={styles.pricingCopy}>
          <p className={styles.kicker}>Preço do Basic</p>
          <h2>Comece pequeno. Use de verdade. Continue se fizer sentido.</h2>
          <p>
            A proposta inicial foi pensada para pequenas empresas que querem
            organizar o atendimento sem começar com um contrato pesado ou uma
            implantação longa.
          </p>
        </div>

        <div className={styles.priceCard}>
          <div className={styles.priceIntro}>
            <span>Primeiros {commercialSite.pricing.introMonths} meses</span>
            <strong>
              {commercialSite.currencyFormatter.format(
                commercialSite.pricing.introMonthly,
              )}
            </strong>
            <small>/mês</small>
          </div>

          <div className={styles.priceAfter}>
            Depois,{" "}
            <strong>
              {commercialSite.currencyFormatter.format(
                commercialSite.pricing.regularMonthly,
              )}
              /mês
            </strong>
          </div>

          <ul>
            {included.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <a className={styles.primaryActionWide} href="#piloto">
            Acompanhar o lançamento
          </a>

          <p className={styles.priceFinePrint}>
            Cada pagamento confirmado concede {commercialSite.paymentPeriodDays}{" "}
            dias de utilização. Sem plano anual obrigatório no MVP.
          </p>
        </div>
      </section>

      <section className={styles.faqSection}>
        <div className={styles.sectionHeading}>
          <p className={styles.kicker}>Perguntas rápidas</p>
          <h2>O que vale saber desde o início.</h2>
        </div>

        <div className={styles.faqList}>
          <details>
            <summary>O WhatsApp fica no nome da plataforma?</summary>
            <p>
              Não. O número e os ativos externos pertencem à empresa cliente. A
              plataforma apenas gerencia a integração autorizada.
            </p>
          </details>
          <details>
            <summary>A IA fala como se fosse uma pessoa?</summary>
            <p>
              Não. A assistente informa que é digital e pode encaminhar o
              atendimento para uma pessoa da equipe quando necessário.
            </p>
          </details>
          <details>
            <summary>Existe fidelidade anual?</summary>
            <p>
              Não no MVP. A cobrança planejada é mensal e cada pagamento
              confirmado concede 30 dias de utilização.
            </p>
          </details>
          <details>
            <summary>É um ERP completo?</summary>
            <p>
              Não. O primeiro produto é focado em clientes, atendimento,
              conversas, agenda, documentos e assistente digital.
            </p>
          </details>
        </div>
      </section>

      <section className={styles.finalCta} id="piloto">
        <div>
          <p className={styles.kicker}>Em desenvolvimento</p>
          <h2>Estamos construindo o MVP para os primeiros clientes.</h2>
          <p>
            O acesso comercial será aberto quando os gates de segurança,
            integração e operação estiverem concluídos.
          </p>
        </div>
        <div className={styles.finalActions}>
          <Link className={styles.primaryAction} href="/crm">
            Já tenho acesso
          </Link>
          <a className={styles.secondaryActionLight} href="#recursos">
            Rever recursos
          </a>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>{commercialSite.brandMark}</span>
          <span>{commercialSite.brandName}</span>
        </div>
        <p>
          Atendimento, clientes e agenda organizados para pequenas empresas.
        </p>
        <span>© 2026</span>
      </footer>
    </main>
  );
}
