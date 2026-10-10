import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (!convexSiteUrl) {
    console.error("NEXT_PUBLIC_CONVEX_SITE_URL is not configured");
    return NextResponse.json(
      { error: "Webhook forwarding is unavailable" },
      { status: 503 }
    );
  }

  try {
    const response = await fetch(`${convexSiteUrl}/clerk-users-webhook`, {
      method: "POST",
      headers: {
        "content-type": request.headers.get("content-type") ?? "application/json",
        "svix-id": request.headers.get("svix-id") ?? "",
        "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
        "svix-signature": request.headers.get("svix-signature") ?? "",
      },
      body: await request.text(),
    });
    return new NextResponse(await response.text(), { status: response.status });
  } catch (error) {
    console.error("Error forwarding webhook:", error);
    return NextResponse.json(
      { error: "Failed to forward webhook" },
      { status: 500 }
    );
  }
}
