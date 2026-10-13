import { api } from "@/convex/_generated/api";
import { readRequestBody } from "@/lib/request-body";
import { getStripe } from "@/lib/stripe";
import { ConvexHttpClient } from "convex/browser";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "No signature" }, { status: 400 });
  if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payment processing is unavailable" }, { status: 503 });
  const body = await readRequestBody(request, 262_144);
  if (body === null) return NextResponse.json({ error: "Webhook too large" }, { status: 413 });
  try { getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET); }
  catch { return NextResponse.json({ error: "Invalid signature" }, { status: 400 }); }
  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    // Convex repeats signature verification: the public action never accepts caller payment claims.
    await convex.action(api.registrationPayments.receiveWebhook, { body, signature });
    return NextResponse.json({ received: true });
  } catch { return NextResponse.json({ error: "Payment reconciliation queued for retry" }, { status: 500 }); }
}
