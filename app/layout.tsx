import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Juntos | Organizar hoje. Construir o amanha.",
  description:
    "Aplicativo financeiro premium com MAYA, assistente para organizar receitas, despesas, metas e planejamento do casal.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/brand/juntos-maya-logo.png",
    apple: "/brand/juntos-maya-logo.png"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#102118"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body>{children}</body>
    </html>
  );
}
