import type { Metadata } from "next";
import "@workspace/design-tokens/css";
import "./styles.css";

export const metadata: Metadata = {
  title: "Gearboxe Internal",
  description: "Internal operations dashboard for Gearboxe Market",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
