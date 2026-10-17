import { ClerkProvider, UserButton } from "@clerk/nextjs";
import type { Metadata } from "next";
import { ConvexClientProvider } from "../convex-provider";
import "@workspace/design-tokens/css";
import "./styles.css";

export const metadata: Metadata = {
  title: "Gearboxe Events",
  description: "Event operations for assigned Gearboxe staff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider signInFallbackRedirectUrl="/staff/events">
      <html lang="en">
        <body>
          <ConvexClientProvider>
            <header className="app-header">
              <a href="/staff/events" className="brand">Gearboxe <span>Events</span></a>
              <UserButton />
            </header>
            {children}
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
