import type { WebhookEvent } from "@clerk/backend";
import { httpRouter } from "convex/server";
import { Webhook } from "svix";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { documentDownload, documentUpload } from "./trustDocuments";
import { autosendWebhook, unsubscribe } from "./notificationHttp";
import { upload } from "./mediaUpload";

const http = httpRouter();
http.route({ path: "/notifications/unsubscribe", method: "GET", handler: unsubscribe });
http.route({ path: "/notifications/unsubscribe", method: "POST", handler: unsubscribe });
http.route({ path: "/autosend-webhook", method: "POST", handler: autosendWebhook });
http.route({ path: "/trust/document", method: "POST", handler: documentUpload });
http.route({ path: "/trust/document", method: "OPTIONS", handler: documentUpload });
http.route({ path: "/trust/document", method: "GET", handler: documentDownload });
http.route({ path: "/vehicle-media/upload", method: "POST", handler: upload });
http.route({ path: "/vehicle-media/upload", method: "OPTIONS", handler: upload });

http.route({
  path: "/clerk-users-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const event = await validateRequest(request);
    if (!event) {
      return new Response("Error occured", { status: 400 });
    }
    switch (event.type) {
      case "user.created": // intentional fallthrough
      case "user.updated":
        await ctx.runMutation(internal.users.upsertFromClerk, {
          data: event.data,
        });
        break;

      case "user.deleted": {
        const clerkUserId = event.data.id!;
        await ctx.runMutation(internal.users.deleteFromClerk, { clerkUserId });
        break;
      }
      default:
        console.log("Ignored Clerk webhook event", event.type);
    }

    return new Response(null, { status: 200 });
  }),
});

async function validateRequest(req: Request): Promise<WebhookEvent | null> {
  const payloadString = await req.text();
  const svixHeaders = {
    "svix-id": req.headers.get("svix-id")!,
    "svix-timestamp": req.headers.get("svix-timestamp")!,
    "svix-signature": req.headers.get("svix-signature")!,
  };
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  try {
    return wh.verify(payloadString, svixHeaders) as unknown as WebhookEvent;
  } catch (error) {
    console.error("Error verifying webhook event", error);
    return null;
  }
}

export default http;
