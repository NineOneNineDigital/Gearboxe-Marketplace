"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@clerk/nextjs";
import { useAction, useMutation } from "convex/react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { validateWantedPhotoFiles } from "./wanted-private-media";

export function usePhotoRequestUpload() {
  const { getToken } = useAuth();
  const beginUpload = useAction(api.photoRequestMedia.beginUpload);
  const finalizeUpload = useAction(api.photoRequestMedia.finalizeUpload);
  const deleteUpload = useMutation(api.photoRequestMedia.deleteUpload);

  async function upload(files: File[], requestId: Id<"photoRequests">) {
    validateWantedPhotoFiles(files);
    if (files.length === 0) return [] as Id<"photoRequestPhotos">[];
    const token = await getToken({ template: "convex" });
    if (!token) throw new Error("Please sign in again before uploading photos.");
    const started: Id<"photoRequestPhotos">[] = [];
    try {
      for (const file of files) {
        const ticket = await beginUpload({ requestId });
        started.push(ticket.photoId);
        const response = await fetch(ticket.uploadUrl, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type }, body: file });
        if (!response.ok) throw new Error("Photo upload failed. Please try again.");
        const result: unknown = await response.json();
        if (!result || typeof result !== "object" || !("storageId" in result) || typeof result.storageId !== "string") throw new Error("Photo upload did not finish. Please try again.");
        await finalizeUpload({ photoId: ticket.photoId, storageId: result.storageId as Id<"_storage"> });
      }
      return started;
    } catch (error) {
      await Promise.allSettled(started.map(photoId => deleteUpload({ photoId })));
      throw error;
    }
  }

  async function discard(ids: Id<"photoRequestPhotos">[]) {
    await Promise.allSettled(ids.map(photoId => deleteUpload({ photoId })));
  }
  return { upload, discard };
}

export function PrivatePhotoRequestPhoto({ photoId, label }: { photoId: Id<"photoRequestPhotos">; label: string }) {
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
        const response = await fetch(`${siteUrl}/photo-request-media/photo?id=${encodeURIComponent(photoId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (!response.ok) throw new Error("Photo unavailable");
        objectUrl = URL.createObjectURL(await response.blob());
        if (active) setUrl(objectUrl);
      } catch { if (active) setFailed(true); }
    })();
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [photoId, getToken]);
  return failed ? <span className="text-xs text-muted-foreground">Private photo unavailable</span> : url ? <a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${label}`}><Image unoptimized src={url} alt={label} width={160} height={120} className="h-30 w-40 rounded-md object-cover" /></a> : <span className="text-xs text-muted-foreground">Loading private photo…</span>;
}
