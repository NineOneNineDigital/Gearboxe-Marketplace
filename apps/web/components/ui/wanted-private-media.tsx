"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@clerk/nextjs";
import { useAction, useMutation } from "convex/react";
import Image from "next/image";
import { useEffect, useState } from "react";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024;

export function validateWantedPhotoFiles(files: File[]) {
  if (files.length > 10) throw new Error("Attach at most 10 photos to one reply.");
  if (files.some(file => !IMAGE_TYPES.has(file.type) || file.size > MAX_BYTES || file.size === 0)) throw new Error("Use JPEG, PNG or WebP photos smaller than 10 MB each.");
}

export function useWantedPhotoUpload() {
  const { getToken } = useAuth();
  const beginUpload = useAction(api.wantedMedia.beginUpload);
  const finalizeUpload = useAction(api.wantedMedia.finalizeUpload);
  const deleteUpload = useMutation(api.wantedMedia.deleteUpload);

  async function upload(files: File[], requestId: Id<"wantedRequests">, conversationId?: Id<"wantedConversations">) {
    validateWantedPhotoFiles(files);
    if (files.length === 0) return [] as Id<"wantedReplyPhotos">[];
    const token = await getToken({ template: "convex" });
    if (!token) throw new Error("Please sign in again before uploading photos.");
    const ready: Id<"wantedReplyPhotos">[] = [];
    const started: Id<"wantedReplyPhotos">[] = [];
    try {
      for (const file of files) {
        const ticket = await beginUpload({ requestId, ...(conversationId ? { conversationId } : {}) });
        started.push(ticket.photoId);
        const response = await fetch(ticket.uploadUrl, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type }, body: file });
        if (!response.ok) throw new Error("Photo upload failed. Please try again.");
        const data: unknown = await response.json();
        if (!data || typeof data !== "object" || !("storageId" in data) || typeof data.storageId !== "string") throw new Error("Photo upload did not finish. Please try again.");
        await finalizeUpload({ photoId: ticket.photoId, storageId: data.storageId as Id<"_storage"> });
        ready.push(ticket.photoId);
      }
      return ready;
    } catch (error) {
      await Promise.allSettled(started.map(photoId => deleteUpload({ photoId })));
      throw error;
    }
  }

  async function discard(ids: Id<"wantedReplyPhotos">[]) {
    await Promise.allSettled(ids.map(photoId => deleteUpload({ photoId })));
  }
  return { upload, discard };
}

export function SelectedWantedPhotos({ files }: { files: File[] }) {
  const [previews, setPreviews] = useState<{ name: string; url: string }[]>([]);
  useEffect(() => {
    const next = files.map(file => ({ name: file.name, url: URL.createObjectURL(file) }));
    setPreviews(next);
    return () => next.forEach(preview => URL.revokeObjectURL(preview.url));
  }, [files]);
  if (previews.length === 0) return null;
  return <ul className="flex flex-wrap gap-2" aria-label="Selected photos">{previews.map((preview, index) => <li key={`${preview.name}-${index}`} className="rounded-md border bg-white p-1"><Image unoptimized src={preview.url} alt={`Selected photo ${index + 1}: ${preview.name}`} width={96} height={72} className="h-18 w-24 object-cover" /></li>)}</ul>;
}

export function PrivateWantedPhoto({ photoId, label }: { photoId: Id<"wantedReplyPhotos">; label: string }) {
  const { getToken } = useAuth();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
    if (!siteUrl) { setFailed(true); return; }
    void (async () => {
      try {
        const token = await getToken({ template: "convex" });
        if (!token) throw new Error("Sign in required");
        const response = await fetch(`${siteUrl}/wanted-media/photo?id=${encodeURIComponent(photoId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (!response.ok) throw new Error("Photo unavailable");
        objectUrl = URL.createObjectURL(await response.blob());
        if (active) setUrl(objectUrl);
      } catch { if (active) setFailed(true); }
    })();
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [photoId, getToken]);
  return failed ? <span className="text-xs text-muted-foreground">Private photo unavailable</span> : url ? <a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${label}`}><Image unoptimized src={url} alt={label} width={160} height={120} className="h-30 w-40 rounded-md object-cover" /></a> : <span className="text-xs text-muted-foreground">Loading private photo…</span>;
}
