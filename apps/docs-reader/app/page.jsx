import Link from "next/link";
import { Box, Heading, Text } from "@chakra-ui/react";
import { ArrowRight, ArrowUpRight, Layers, BookOpen, Network, ShieldCheck } from "lucide-react";
import SiteShell from "@/components/site-shell";
import { domains, BLUEPRINT } from "@/lib/content";
import { PILOT_NAV } from "@/lib/pilot-modules";

export default function Home() {
  return <SiteShell>
    <div className="page-container">
      <section className="home-hero" aria-labelledby="home-title">
        <div>
          <span className="eyebrow">SYNDES SYSTEM · BIBLIOTECA</span>
          <Heading as="h1" id="home-title" className="serif-title">Um sistema.<br/><span className="hero-highlight">Muitas possibilidades.</span><br/>Uma visão clara.</Heading>
          <Text as="p" className="hero-lead">Uma plataforma modular para conectar atendimento, relacionamento e operação. Explore o que cada parte resolve, como se relaciona com as demais e o que ainda precisa evoluir.</Text>
          <div className="hero-links">
            <Link href="/modulos/crm" className="primary-link">Explorar CRM <ArrowRight size={17}/></Link>
            <a className="secondary-link" href="#entenda">Entenda a estrutura <ArrowRight size={15}/></a>
          </div>
        </div>
        <div className="hero-art" aria-label="Representação de três camadas: experiência, serviços e dados" role="img">
          <div className="art-glow"/>
          <div className="architecture-art">
            <div><strong>Experiências</strong><span>pessoas</span></div>
            <div><strong>Serviços e módulos</strong><span>regras</span></div>
            <div><strong>Dados e operação</strong><span>confiança</span></div>
          </div>
          <div className="art-caption">Uma plataforma, responsabilidades claras.</div>
        </div>
      </section>
      <section className="pilot-directory" id="nucleos" aria-labelledby="pilot-directory-title">
        <div className="intro-block"><span className="eyebrow">RECORTE ATUAL · 5 ÁREAS</span>
          <Heading as="h2" id="pilot-directory-title" className="serif-title">Decida por área.<br/>Trabalhe por ação.</Heading>
          <p>Os cinco núcleos estão disponíveis para leitura focada. A documentação usa as fontes reais do repositório e separa escopo, implementação e homologação. Os demais módulos permanecem no catálogo técnico, sem fichas artificiais.</p></div>
        <div className="pilot-directory-grid">{PILOT_NAV.map((item,i)=><Link key={item.slug} href={"/modulos/"+item.slug} className="pilot-directory-card">
          <span className="eyebrow">{String(i+1).padStart(2,"0")} / {item.code}</span><strong>{item.title}</strong>
          <span>{item.subtitle}</span><span className="pilot-directory-open">Abrir documentação <ArrowRight size={14}/></span></Link>)}</div>
        <div className="pilot-template-access"><BookOpen size={17}/>
          <div><strong>Modelo completo de documentação</strong><p>Ficha Mestre, ficha por ação e guia de adoção incremental, para aprofundar um módulo de cada vez.</p></div>
          <a href="https://github.com/delmacy/syndes-system/blob/main/docs/standards/TEMPLATE-FICHA-MODULO.md" target="_blank" rel="noopener noreferrer">Abrir template <ArrowUpRight size={15}/></a>
        </div>
      </section><hr className="divider-line"/>
      <section className="section-space" id="entenda">
        <div className="intro-block">
          <span className="eyebrow">01 / A PLATAFORMA</span>
          <Heading as="h2" className="serif-title">Entenda o conjunto.<br/>Depois aprofunde um módulo.</Heading>
          <p>A biblioteca organiza a compreensão do Syndes por áreas de responsabilidade. Você começa pela visão humana de cada assunto e só consulta contratos, código e evidências quando precisa de precisão técnica.</p>
        </div>
        <div className="domain-list">
          {domains.map(d=>{
            const inner=<><span className="domain-no">{d.id}</span><div><h3>{d.name}{d.pilot&&<span className="tag-ready">Módulo-piloto disponível</span>}</h3><p>{d.description}</p></div><span className="domain-examples">{d.examples}</span><span className="domain-icon">{d.pilot?<ArrowUpRight size={17}/>:<Layers size={16}/>}</span></>;
            return d.pilot?<Link href="/modulos/crm" key={d.id} className="domain-row pilot">{inner}</Link>:<div key={d.id} className="domain-row">{inner}</div>;
          })}
        </div>
      </section>
    </div>
    <section className="principle-band">
      <div className="page-container principle-inner">
        <div><span className="eyebrow" style={{color:"#A7C8FA"}}>02 / UMA REGRA EDITORIAL</span><Heading as="h2">Primeiro entender.<br/>Depois verificar.</Heading></div>
        <div>
          <p>Cada módulo responde, nesta ordem: o que faz, como funciona e qual é sua situação real. Explicações e exemplos vêm primeiro. Links de referência aparecem ao final de cada assunto, sem interromper a leitura.</p>
          <p>O que foi planejado, implementado, testado ou homologado permanece distinguível. Ter um arquivo no GitHub não significa que o serviço está ativo.</p>
          <a href={BLUEPRINT+"/MAPA-TECNICO-POR-CAMADAS.md"} target="_blank" rel="noopener noreferrer">Consultar o Blueprint técnico <ArrowUpRight size={13} style={{display:"inline"}}/></a>
        </div>
      </div>
    </section>
    <div className="page-container">
      <section className="section-space">
        <div className="intro-block">
          <span className="eyebrow">03 / COMO LER UM MÓDULO</span>
          <Heading as="h2" className="serif-title">Uma leitura com começo,<br/>meio e próximo passo.</Heading>
        </div>
        <div className="reading-path">
          <div><small>01 — ENTENDER</small><h3>Qual problema resolve?</h3><p>Visão geral, quem utiliza, casos de uso e processos. A documentação se apresenta como uma história coerente.</p></div>
          <div><small>02 — CONSTRUIR</small><h3>Como foi desenhado?</h3><p>Arquitetura, contratos, dados e dependências. O aprofundamento técnico acontece no lugar certo.</p></div>
          <div><small>03 — VERIFICAR</small><h3>Em que podemos confiar?</h3><p>Segurança, interfaces, testes, pendências e evolução. Comprovado e planejado não se confundem.</p></div>
        </div>
      </section>
      <section className="pilot-feature" aria-labelledby="pilot-heading">
        <div><span className="eyebrow">PILOTO TÉCNICO · P01</span><Heading as="h2" id="pilot-heading">CRM — Relacionamentos</Heading><p>O CRM é o piloto aprofundado, com operações e inventários técnicos; Core Platform, Blueprint, WhatsApp e Security agora possuem leitura própria por função e ação.</p></div>
        <Link className="primary-link" href="/modulos/crm">Explorar CRM <ArrowRight size={16}/></Link>
      </section>
      <div className="endnote">Alguns itens avançados do Blueprint são mantidos exclusivamente na <a href={BLUEPRINT+"/MAPA-TECNICO-POR-CAMADAS.md"} target="_blank" rel="noopener noreferrer">documentação técnica original</a>. Esta experiência não substitui os registros oficiais nem aprova funcionalidades.</div>
    </div>
  </SiteShell>;
}
