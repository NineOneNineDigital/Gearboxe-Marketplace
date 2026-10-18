import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Azeret_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { ConvexClientProvider } from "../convex-provider";
import "@workspace/design-tokens/css";
import "./styles.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const azeret = Azeret_Mono({
  subsets: ["latin"],
  variable: "--font-azeret-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Gearboxe Admin",
  description: "Gearboxe marketplace and event operations",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider signInFallbackRedirectUrl="/">
      <html lang="en">
        <body className={`${jakarta.variable} ${azeret.variable} antialiased`}>
          <ConvexClientProvider>
            <div className="market-page flex h-dvh flex-col overflow-hidden">
              {children}
            </div>
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
