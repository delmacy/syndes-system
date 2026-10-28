import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./styles.css";

export const metadata: Metadata = {
  title: {
    default: "Syndes — Atendimento e clientes em um só lugar",
    template: "%s · Syndes",
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
