import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import { ConvexClientProvider } from "@/lib/convex-provider";
import "./global.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Gearboxe Market — Coming Soon",
  description:
    "Local popup markets for used car buyers and sellers. Join the waitlist to be the first to know when we launch.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={`${inter.variable} ${poppins.variable}`} lang="en">
      <body className="font-sans antialiased">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
