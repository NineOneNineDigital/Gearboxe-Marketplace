import { Suspense } from "react";
import VehiclesClient from "./vehicles-client";
import { vehicleBrowseMetadata } from "@/lib/seo";

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return vehicleBrowseMetadata(Object.keys(params).length > 0);
}

export default function VehiclesPage() {
  return <Suspense fallback={<div className="market-page min-h-screen p-10" role="status">Loading inventory…</div>}><VehiclesClient /></Suspense>;
}
