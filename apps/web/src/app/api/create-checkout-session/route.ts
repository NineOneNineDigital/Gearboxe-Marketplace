import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { readRequestBody } from "@/lib/request-body";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const raw = await readRequestBody(request, 2048);
    if (raw === null) return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const { eventId, vehicleId, acceptRules } = body as Record<string, unknown>;
    if (typeof eventId !== "string" || typeof vehicleId !== "string" || eventId.length > 128 || vehicleId.length > 128) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    const token = await getToken({ template: "convex" });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    convex.setAuth(token);
    const checkout = await convex.action(api.registrationPayments.createCheckout, { eventId: eventId as Id<"events">, vehicleId: vehicleId as Id<"vehicles">, acceptRules: acceptRules === true });
    return NextResponse.json(checkout);
  } catch (error) {
    return NextResponse.json({ error: error instanceof ConvexError && typeof error.data === "string" ? error.data : "Unable to start checkout. Refresh your registrations and try again." }, { status: 400 });
  }
}
