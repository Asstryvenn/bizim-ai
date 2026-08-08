import type { Metadata } from "next";
import ThemeProvider from "@/components/ThemeProvider";
import LanguageProvider from "@/components/LanguageProvider";
import ThemedToaster from "@/components/ThemedToaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bizim — AI-платформа для малого бизнеса",
  description: "Bizim помогает владельцам малого бизнеса в Казахстане анализировать данные и получать рекомендации от AI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="bg-paper text-ink font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <LanguageProvider>
            {children}
            <ThemedToaster />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
