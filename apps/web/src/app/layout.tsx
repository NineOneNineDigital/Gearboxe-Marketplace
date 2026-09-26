import { ToastContainer } from "@/components/ui/toast-container";
import { ConvexClientProvider } from "@/lib/convex-provider";
import { ClerkProvider } from "@clerk/nextjs";
import "@workspace/design-tokens/css";
import type { Metadata } from "next";
import "./global.css";

export const metadata: Metadata = {
  title: "Gearboxe Market",
  description:
    "Connect with local car sellers and buyers at monthly popup events",
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
        <body className="antialiased">
          <ConvexClientProvider>
            {children}
            <ToastContainer />
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
