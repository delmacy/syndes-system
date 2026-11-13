"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, Flex, HStack, Text } from "@chakra-ui/react";
import { BookOpen, ArrowUpRight, Menu, X, FileText } from "lucide-react";
import { useState } from "react";

export default function SiteShell({ children }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  return <Box minH="100vh" bg="var(--surface)" color="var(--ink)">
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-brand" onClick={() => setOpen(false)} aria-label="Biblioteca Syndes, início">
          <span className="brand-symbol"><BookOpen size={19} strokeWidth={2} /></span>
          <span className="brand-name">SYNDES <span className="brand-sub">/ biblioteca</span></span>
        </Link>
        <nav className={open ? "site-nav site-nav-open" : "site-nav"} aria-label="Navegação principal">
          <Link onClick={() => setOpen(false)} className={path === "/" ? "nav-current" : ""} href="/">Visão geral</Link>
          <Link onClick={() => setOpen(false)} className={path.startsWith("/modulos/") ? "nav-current" : ""} href="/modulos/crm">Módulo CRM <span className="nav-mini">P01</span></Link>
          <a href="https://delmacy.github.io/syndes-system/blueprint/MAPA-TECNICO-POR-CAMADAS/" target="_blank" rel="noopener noreferrer">Blueprint técnico <ArrowUpRight size={13}/></a>
        </nav>
        <button className="mobile-toggle" type="button" aria-expanded={open} aria-label={open ? "Fechar menu" : "Abrir menu"} onClick={() => setOpen(v => !v)}>{open ? <X size={21}/> : <Menu size={21}/>}</button>
      </div>
    </header>
    <Box as="main" id="main-content">{children}</Box>
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div><span className="footer-name">SYNDES</span><p>Documentação para compreender, discutir e evoluir.</p></div>
        <div><Text fontSize="sm">Piloto editorial · CRM P01</Text><a href="https://github.com/delmacy/syndes-system" target="_blank" rel="noopener noreferrer"><FileText size={14}/> Fonte versionada <ArrowUpRight size={13}/></a></div>
      </div>
    </footer>
  </Box>;
}
