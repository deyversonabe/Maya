import type { Metadata, Viewport } from "next";
import { AuthGate } from "@/components/app/auth-gate";
import { PwaClient } from "@/components/app/pwa-client";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maya | Organizar hoje. Construir o amanha.",
  description:
    "Aplicativo financeiro premium com MAYA, assistente para organizar receitas, despesas, metas e planejamento do casal.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/brand/maya-icon-192.png",
    apple: "/brand/maya-icon-192.png"
  },
  appleWebApp: {
    capable: true,
    title: "Maya",
    statusBarStyle: "black-translucent"
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
      <body>
        <PwaClient />
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
