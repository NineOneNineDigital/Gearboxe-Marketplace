import { ToastContainer } from "@/components/ui/toast-container";
import { ConvexClientProvider } from "@/lib/convex-provider";
import { ClerkProvider } from "@clerk/nextjs";
import "@workspace/design-tokens/css";
import type { Metadata } from "next";
import { Azeret_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { absoluteUrl, appOrigin } from "@/lib/seo";
import "./global.css";

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
  metadataBase: appOrigin(),
  title: "Gearboxe Market",
  description:
    "Connect with local car sellers and buyers at monthly popup events",
  openGraph: {
    title: "Gearboxe Market", description: "Discover vehicles and connect with local sellers on Gearboxe.",
    type: "website", siteName: "Gearboxe", url: absoluteUrl("/"),
    images: [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: [absoluteUrl("/opengraph-image")] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      signInFallbackRedirectUrl="/myAccount"
      signUpFallbackRedirectUrl="/myAccount"
    >
      <html lang="en">
        <body className={`${jakarta.variable} ${azeret.variable} antialiased`}>
          <ConvexClientProvider>
            {children}
            <ToastContainer />
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
