"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { absoluteUrl } from "@/lib/seo";
import { sellerCardText, sellerSharePost } from "@/lib/seller-share-kit";
import { isTrustedImageUrl } from "@/lib/trusted-images";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "convex/react";
import { Download, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "./button";

function imageForCanvas(url: string) {
  // The same-origin Next image optimizer avoids tainting the download canvas.
  return `/_next/image?url=${encodeURIComponent(url)}&w=1200&q=85`;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const photo = new window.Image();
    photo.onload = () => resolve(photo);
    photo.onerror = () => reject(new Error("The approved photo could not be loaded for download."));
    photo.src = imageForCanvas(url);
  });
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startingSize: number) {
  let size = startingSize;
  do {
    ctx.font = `700 ${size}px Arial, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  } while (size > 30);
  return size;
}

async function downloadCard(photoUrl: string, copy: ReturnType<typeof sellerCardText>, id: string) {
  const photo = await loadImage(photoUrl);
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1200;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot create the photo card.");

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 1200, 1200);
  const photoHeight = 790;
  const scale = Math.max(1200 / photo.naturalWidth, photoHeight / photo.naturalHeight);
  const width = photo.naturalWidth * scale;
  const height = photo.naturalHeight * scale;
  ctx.drawImage(photo, (1200 - width) / 2, (photoHeight - height) / 2, width, height);

  ctx.fillStyle = "#174e4b";
  ctx.font = "700 30px Arial, sans-serif";
  ctx.fillText("GEARBOXE", 64, 857);
  ctx.fillStyle = "#1f2937";
  fitText(ctx, copy.name, 1072, 64);
  ctx.fillText(copy.name, 64, 949, 1072);
  ctx.fillStyle = "#174e4b";
  ctx.font = "700 56px Arial, sans-serif";
  ctx.fillText(copy.price, 64, 1045, 1072);
  ctx.fillStyle = "#4b5563";
  ctx.font = "32px Arial, sans-serif";
  ctx.fillText(copy.city, 64, 1110, 1072);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(result => result ? resolve(result) : reject(new Error("The photo card could not be saved.")), "image/png");
  });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = `gearboxe-${id}-photo-card.png`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export function SellerShareKit({ id, onClose }: { id: Id<"vehicles">; onClose: () => void }) {
  const listing = useQuery(api.vehicles.getSellerShareListing, { id });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const photoUrl = listing?.leadPhotoUrl && isTrustedImageUrl(listing.leadPhotoUrl) ? listing.leadPhotoUrl : undefined;
  const post = listing ? sellerSharePost(listing, absoluteUrl(`/vehicles/${listing.id}`)) : "";
  const card = listing ? sellerCardText(listing) : null;

  const copyPost = async () => {
    if (!post) return;
    try {
      await navigator.clipboard.writeText(post);
      setMessage("Post copied. Check the listing before sharing if its availability changes.");
    } catch {
      setMessage("Copy failed. Select the preview text to copy it manually.");
    }
  };

  const saveCard = async () => {
    if (!photoUrl || !card) return;
    setBusy(true);
    setMessage("");
    try {
      await downloadCard(photoUrl, card, id);
      setMessage("Photo card downloaded. It does not include availability because listings can change.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to download the photo card.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white p-5 shadow-xl sm:p-7">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <Dialog.Title className="text-xl font-semibold">Share your listing</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-gray-600">Preview what others will see before copying or downloading.</Dialog.Description>
          </div>
          <Dialog.Close asChild><Button variant="ghost" size="sm" aria-label="Close share tools"><X className="h-5 w-5" /></Button></Dialog.Close>
        </div>
        {listing === undefined ? <p role="status">Loading approved listing...</p> : !listing ? (
          <p role="alert" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">This listing is no longer public, so its sharing tools are unavailable.</p>
        ) : (
          <div className="space-y-6">
            <section aria-labelledby="seller-post-title">
              <h3 id="seller-post-title" className="mb-2 font-semibold">Ready-to-post text</h3>
              <textarea readOnly value={post} aria-label="Ready-to-post text preview" className="h-32 w-full rounded-lg border border-gray-300 p-3 text-sm" />
              <Button type="button" className="mt-2" onClick={copyPost}>Copy post</Button>
            </section>
            <section aria-labelledby="seller-card-title">
              <h3 id="seller-card-title" className="mb-2 font-semibold">Photo card</h3>
              {photoUrl && card ? (
                <>
                  <div className="overflow-hidden rounded-lg border border-gray-200" aria-label="Photo card preview">
                    <div className="relative aspect-[1200/790] bg-gray-100"><Image src={photoUrl} alt={`Approved lead photo of ${card.name}`} fill sizes="(max-width: 640px) 100vw, 560px" className="object-cover" /></div>
                    <div className="space-y-1 bg-white p-4">
                      <p className="text-xs font-bold tracking-wide text-primary">GEARBOXE</p>
                      <p className="text-lg font-bold text-gray-900">{card.name}</p>
                      <p className="text-lg font-bold text-primary">{card.price}</p>
                      {card.city && <p className="text-sm text-gray-600">{card.city}</p>}
                    </div>
                  </div>
                  <Button type="button" variant="outline" className="mt-3" disabled={busy} onClick={saveCard}><Download className="mr-2 h-4 w-4" />{busy ? "Preparing card..." : "Download photo card"}</Button>
                </>
              ) : <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">An approved lead photo is required for a photo card. You can still copy the post.</p>}
            </section>
            {message && <p role="status" className="text-sm text-gray-700">{message}</p>}
          </div>
        )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
