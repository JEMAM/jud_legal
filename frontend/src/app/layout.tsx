import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import ClientWrapper from "@/components/ClientWrapper";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LegalMind AI Suite",
  description: "Sistema Inteligente de Gestão Diária Jurídica com Multi-Agentes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="h-full bg-slate-950 text-slate-100 font-sans flex min-h-screen">
        <ClientWrapper>
          {children}
        </ClientWrapper>
      </body>
    </html>
  );
}
