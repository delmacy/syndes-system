import { Box, Heading, Text } from "@chakra-ui/react";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import ProposalEditor from "./proposal-editor";

function ContentDetails({section}) {
  return <>
    {section.paragraphs?.map((p,i)=><p className="copy" key={i}>{p}</p>)}
    {section.stats&&<div className="stat-strip">{section.stats.map(([key,value])=><div className="stat-box" key={key}><span>{key}</span><strong>{value}</strong></div>)}</div>}
    {section.bullets&&<ul className="article-bullets">{section.bullets.map(b=><li key={b}>{b}</li>)}</ul>}
    {section.stories&&<div className="story-stack">{section.stories.map(([title,text])=><div className="story" key={title}><strong>{title}</strong><p>{text}</p></div>)}</div>}
    {section.steps&&<div className="flow-steps" aria-label="Etapas ilustrativas">{section.steps.map((step,i)=><div key={step} style={{display:"contents"}}>{i>0&&<ArrowRight className="flow-arrow" size={16}/>}<span className="flow-step">{step}</span></div>)}</div>}
    {section.table&&<table className="article-table"><thead><tr>{section.table.headers.map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{section.table.rows.map((row,i)=><tr key={i}>{row.map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table>}
    {section.milestones&&<div className="milestone-list">{section.milestones.map(([id,title])=><div className="milestone-row" key={id}><code>{id}</code><span>{title}</span></div>)}</div>}
  </>;
}

export default function ReadingSection({section,moduleId}) {
  return <Box as="section" className="reading-section" id={section.id} aria-labelledby={"title-"+section.id}>
    <span className="eyebrow">{section.eyebrow}</span>
    <div className="section-heading"><span className="section-num">{section.number}</span><Heading as="h2" id={"title-"+section.id}>{section.title}</Heading></div>
    <Text as="p" className="section-lead">{section.lead}</Text>
    <ContentDetails section={section}/>
    <div className="source-footer" aria-label={"Referências de "+section.title}>
      <span className="source-label">Para consultar as fontes</span>
      <div className="source-links">{section.references.map(r=><a href={r.href} key={r.href} target="_blank" rel="noopener noreferrer">{r.name}<ArrowUpRight size={12}/></a>)}</div>
    </div>
    <ProposalEditor moduleId={moduleId} sectionId={section.id} sectionTitle={section.title} sourceLink={section.references[0]?.href||""}/>
  </Box>;
}
