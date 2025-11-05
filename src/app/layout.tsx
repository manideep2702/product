import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Serif } from "next/font/google";
import "./globals.css";
import SiteNavbar from "@/components/nav/site-navbar";
import Providers from "@/components/Providers";
import { Footer7 } from "@/components/ui/footer-7";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSerif = Noto_Serif({
  subsets: ["latin"],
  variable: "--font-noto-serif",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Sree Sabari Sastha Seva Samithi",
  description: "Sree Sabari Sastha Seva Samithi (SSSSS)",
  icons: {
    icon: "/logo.jpeg",
    shortcut: "/logo.jpeg",
    apple: "/logo.jpeg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} ${notoSerif.className} antialiased`}>
        <Providers>
          <header className="sticky top-0 z-50 w-full">
            <SiteNavbar />
          </header>
          <main className="pt-0">{children}</main>
          <footer className="border-t border-white/10 bg-background/60">
            <Footer7
              logo={{
                url: "/",
                src: "/logo.jpeg",
                alt: "Sree Sabari Sastha Seva Samithi",
                title: "Sree Sabari Sastha Seva Samithi",
              }}
            />
          </footer>
        </Providers>
      </body>
    </html>
  );
}
