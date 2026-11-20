"use client";

import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";
import { api } from "@/convex/_generated/api";
import { isTrustedImageUrl } from "@/lib/trusted-images";
import { useQuery } from "convex/react";
import Image from "next/image";
import Link from "next/link";
import type { Id } from "@/convex/_generated/dataModel";

type ComparisonCar = {
  id: Id<"vehicles">;
  title: string;
  year: number;
  make: string;
  model: string;
  price: number;
  mileage: number;
  mileageUnit?: string;
  status: string;
  location?: { city: string; state: string };
  titleStatus?: string;
  serviceRecords?: string;
  damageDisclosure?: string;
  accidentDisclosure?: string;
  mechanicalIssues?: string;
  photoUrl?: string;
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("en-US");

export default function ComparisonClient({ token }: { token: string }) {
  const comparison = useQuery(api.comparisons.getPublic, { token });
  const cars: ComparisonCar[] = comparison?.cars ?? [];
  const has = (field: "titleStatus" | "serviceRecords" | "damageDisclosure" | "accidentDisclosure" | "mechanicalIssues") =>
    cars.some(car => Boolean(car[field]));

  return <div className="market-page min-h-screen flex flex-col">
    <Navbar />
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Compare vehicles</h1>
        <p className="mt-2 text-gray-600">Prices and availability reflect the current listings.</p>
      </div>

      {comparison === undefined ? <p role="status">Loading comparison…</p>
        : comparison === null ? <div className="rounded-xl border bg-white p-8">
          <h2 className="text-xl font-semibold">This comparison is unavailable</h2>
          <p className="mt-2 text-gray-600">The link may have been deleted or may be invalid.</p>
          <Link className="mt-4 inline-block font-medium text-primary underline" href="/vehicles">Browse vehicles</Link>
        </div>
        : <>
          {comparison.unavailableCount > 0 && <p role="status" className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
            {comparison.unavailableCount} {comparison.unavailableCount === 1 ? "vehicle is" : "vehicles are"} no longer publicly available and {comparison.unavailableCount === 1 ? "is" : "are"} hidden from this comparison.
          </p>}
          {cars.length === 0 ? <div className="rounded-xl border bg-white p-8">
            <h2 className="text-xl font-semibold">No vehicles available to compare</h2>
            <p className="mt-2 text-gray-600">The vehicles in this link are no longer public.</p>
            <Link className="mt-4 inline-block font-medium text-primary underline" href="/vehicles">Browse vehicles</Link>
          </div> : <>
            <div className="overflow-x-auto rounded-xl border bg-white" role="region" aria-label="Vehicle comparison" tabIndex={0}>
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <thead><tr>
                  <th scope="col" className="sticky left-0 z-10 w-40 min-w-40 border-b border-r bg-white p-4 align-top">Vehicle</th>
                  {cars.map(car => <th scope="col" key={car.id} className="min-w-56 border-b p-4 align-top font-normal">
                    <Link href={`/vehicles/${car.id}`} className="block font-semibold text-gray-900 underline-offset-2 hover:underline focus:underline">
                      {car.photoUrl && isTrustedImageUrl(car.photoUrl) ? <Image src={car.photoUrl} alt="" width={320} height={200} className="mb-3 aspect-[8/5] w-full rounded-lg object-cover" /> : <span className="mb-3 flex aspect-[8/5] w-full items-center justify-center rounded-lg bg-gray-100 text-gray-500">No photo</span>}
                      {car.title}
                    </Link>
                    <span className="mt-1 block text-gray-600">{car.year} {car.make} {car.model}</span>
                  </th>)}
                </tr></thead>
                <tbody>
                  <Row label="Price" values={cars.map(car => money.format(car.price))} />
                  <Row label="Availability" values={cars.map(car => car.status === "reserved" ? "Reserved — no new offers" : "Available")} />
                  <Row label="Mileage" values={cars.map(car => `${number.format(car.mileage)} ${car.mileageUnit === "km" ? "km" : "miles"}`)} />
                  <Row label="Location" values={cars.map(car => car.location ? `${car.location.city}, ${car.location.state}` : "Not provided")} />
                  {has("titleStatus") && <Row label="Title status" values={cars.map(car => car.titleStatus ?? "Not provided")} />}
                  {has("serviceRecords") && <Row label="Service records" values={cars.map(car => car.serviceRecords ?? "Not provided")} />}
                  {has("damageDisclosure") && <Row label="Damage disclosure" values={cars.map(car => car.damageDisclosure ?? "Not provided")} />}
                  {has("accidentDisclosure") && <Row label="Accident disclosure" values={cars.map(car => car.accidentDisclosure ?? "Not provided")} />}
                  {has("mechanicalIssues") && <Row label="Mechanical issues" values={cars.map(car => car.mechanicalIssues ?? "Not provided")} />}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-gray-600">Listing details can change. Open a vehicle for the latest information before contacting its seller.</p>
          </>}
        </>}
    </main>
    <Footer />
  </div>;
}

function Row({ label, values }: { label: string; values: string[] }) {
  return <tr className="border-b last:border-b-0">
    <th scope="row" className="sticky left-0 z-10 border-r bg-white p-4 font-medium text-gray-700">{label}</th>
    {values.map((value, index) => <td key={index} className="p-4 align-top text-gray-900 whitespace-pre-wrap break-words">{value}</td>)}
  </tr>;
}
