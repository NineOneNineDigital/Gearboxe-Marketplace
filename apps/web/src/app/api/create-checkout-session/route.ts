import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { stripe } from "@/lib/stripe";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { userId, getToken } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { eventId, vehicleId } = body as Record<string, unknown>;

    if (typeof eventId !== "string" || typeof vehicleId !== "string") {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const token = await getToken({ template: "convex" });
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    convex.setAuth(token);

    const checkout = await convex.query(api.registrations.getCheckoutContext, {
      eventId: eventId as Id<"events">,
      vehicleId: vehicleId as Id<"vehicles">,
    });

    const registrationPriceCents = Number(
      process.env.EVENT_REGISTRATION_PRICE_CENTS
    );
    if (
      !Number.isSafeInteger(registrationPriceCents) ||
      registrationPriceCents <= 0
    ) {
      console.error("EVENT_REGISTRATION_PRICE_CENTS is not configured");
      return NextResponse.json(
        { error: "Registration payments are unavailable" },
        { status: 503 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Vendor Registration - ${checkout.event.name}`,
              description: `Registration for ${checkout.vehicle.year} ${checkout.vehicle.make} ${checkout.vehicle.model}`,
            },
            unit_amount: registrationPriceCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/myAccount?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/myAccount/new-listing`,
      metadata: {
        userId: checkout.user.id,
        eventId: checkout.event.id,
        vehicleId: checkout.vehicle.id,
      },
      customer_email: checkout.user.email,
    });

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
