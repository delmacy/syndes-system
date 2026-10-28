import Link from "next/link";
import styles from "./commercial.module.css";
import { commercialSite } from "@/modules/commercial-site/site-config";

const features = [
  {
    title: "Clientes organizados",
    text: "Pessoas, empresas, contatos, histórico e contexto reunidos para a equipe encontrar o que precisa.",
    icon: "01",
  },
  {
    title: "WhatsApp no atendimento",
    text: "Um número no Basic, conectado ao fluxo de atendimento da empresa em vez de ficar isolado em aparelhos.",
    icon: "02",
  },
  {
    title: "Inbox compartilhada",
    text: "Conversas em um só lugar para acompanhar, assumir e continuar atendimentos com contexto.",
    icon: "03",
  },
  {
    title: "Agenda operacional",
    text: "Organize disponibilidade, compromissos, reagendamentos, cancelamentos e lembretes.",
    icon: "04",
  },
  {
    title: "Assistente digital N1",
    text: "Tira dúvidas, faz triagem, entende áudio, organiza contexto, agenda e chama uma pessoa quando necessário.",
    icon: "05",
  },
  {
    title: "Documentos e e-mail",
    text: "Mantenha documentos relacionados ao cliente e uma caixa de e-mail integrada ao atendimento.",
    icon: "06",
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
              <span className={styles.featureIcon}>{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
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
