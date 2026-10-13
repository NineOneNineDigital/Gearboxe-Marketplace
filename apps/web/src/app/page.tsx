import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";
import HomeClient from "./home-client";

export const metadata: Metadata = { alternates: { canonical: absoluteUrl("/") } };
export default function HomePage() { return <HomeClient />; }
