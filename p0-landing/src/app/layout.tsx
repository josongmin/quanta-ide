import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Outfit } from "next/font/google";
import { ThemeProvider } from "@/app/providers/ThemeProvider";
import "@/shared/styles/aurora.css";
import "@/shared/styles/animations.css";
import "@/shared/styles/nav-hero.css";
import "@/shared/styles/prompt-card.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["500", "600"],
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "p0 Labs — Stop explaining your codebase",
  description:
    "Every other agent starts from a blank slate. p0 starts from your system. No ticket-writing. No context dumps. Just results that hold together.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-aurora="violet"
      className={`${inter.variable} ${jetbrainsMono.variable} ${outfit.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var a=localStorage.getItem('p0-aurora');if(a&&/^(violet|ocean|emerald|sunset|rose|slate|midnight|lavender|amber|mint|berry|neon|dusk|glacier|moss|wine|candy|storm|jungle|sakura|honey|void)$/.test(JSON.parse(a).state?.aurora||''))document.documentElement.setAttribute('data-aurora',JSON.parse(a).state.aurora)}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen overflow-hidden bg-[#0d0d12] font-sans text-white antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
