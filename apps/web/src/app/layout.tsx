import type { Metadata } from "next";
import type { ReactNode } from "react";
import { commercialSite } from "@/modules/commercial-site/site-config";
import "./styles.css";

export const metadata: Metadata = {
  title: {
    default: `${commercialSite.brandName} — Atendimento e clientes em um só lugar`,
    template: `%s · ${commercialSite.brandName}`,
  },
  description:
    "Organize clientes, conversas, WhatsApp, agenda e atendimento com uma assistente digital de primeiro nível.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
