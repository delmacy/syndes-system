import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/ibm-plex-mono/500.css";
import Providers from "./providers";
import "./globals.css";
export const metadata = { title: "Biblioteca Syndes — Sistema e módulos", description: "Uma visão humana, contínua e verificável dos módulos do Syndes System." };
export default function RootLayout({children}) { return <html lang="pt-BR"><body><Providers>{children}</Providers></body></html>; }
