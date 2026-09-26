import { api } from "@/convex/_generated/api";
import { stripe } from "@/lib/stripe";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextRequest, NextResponse } from "next/server";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { eventId, vehicleId, amount } = await request.json();

    if (!eventId || !vehicleId || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get user details
    const user = await convex.query(api.users.getUser, { clerkId: userId });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get event details
    const event = await convex.query(api.events.getEventById, { id: eventId });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Get vehicle details
    const vehicle = await convex.query(api.vehicles.getVehicleById, {
      id: vehicleId,
    });
    if (!vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Vendor Registration - ${event.name}`,
              description: `Registration for ${vehicle.year} ${vehicle.make} ${vehicle.model}`,
            },
            unit_amount: formatAmountForStripe(amount),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/myAccount?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/myAccount/new-listing`,
      metadata: {
        userId: user._id,
        eventId,
        vehicleId,
      },
      customer_email: user.email,
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

function formatAmountForStripe(amount: number): number {
  return Math.round(amount * 100);
}
