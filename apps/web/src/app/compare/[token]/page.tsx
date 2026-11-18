import type { Metadata } from "next";
import ComparisonClient from "./comparison-client";

export const metadata: Metadata = {
  title: "Compare vehicles | Gearboxe",
  robots: { index: false, follow: false },
};

export default async function ComparisonPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ComparisonClient token={token} />;
}
