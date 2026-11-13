import Providers from "./providers";
import "./globals.css";
export const metadata = { title: "Biblioteca Syndes — Sistema e módulos", description: "Uma visão humana, contínua e verificável dos módulos do Syndes System." };
export default function RootLayout({children}) { return <html lang="pt-BR"><body><Providers>{children}</Providers></body></html>; }
