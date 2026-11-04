"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { MAX_PHOTOS, MAX_UPLOAD_BYTES, MIME_TYPES } from "@/convex/lib/mediaPolicy";
import type { Id } from "@/convex/_generated/dataModel";
import { isTrustedImageUrl } from "@/lib/trusted-images";
import { useAction, useMutation } from "convex/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export interface ListingMedia {
  id: Id<"vehicleMedia">;
  caption: string;
  url: string;
  thumbnailUrl: string;
}
interface UploadEntry {
  key: string;
  file?: File;
  media?: ListingMedia;
  status: "uploading" | "processing" | "ready" | "failed";
  progress: number;
  error?: string;
  replaces?: string;
}
interface Props {
  value: ListingMedia[];
  legacyPhotos: string[];
  onChange: (value: ListingMedia[]) => void;
  onLegacyChange: (photos: string[]) => void;
  onBusyChange: (busy: boolean) => void;
  disabled?: boolean;
}
const ALLOWED_TYPES = new Set<string>(MIME_TYPES);

function uploadFile(url: string, file: File, progress: (percentage: number) => void, requests: Set<XMLHttpRequest>) {
  return new Promise<Id<"_storage">>((resolve, reject) => {
    const request = new XMLHttpRequest();
    requests.add(request);
    const finish = () => requests.delete(request);
    request.open("POST", url);
    request.timeout = 120_000;
    request.setRequestHeader("Content-Type", file.type);
    request.upload.onprogress = event => { if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 100)); };
    request.onload = () => {
      finish();
      try {
        if (request.status < 200 || request.status >= 300) throw new Error("Upload failed. Please retry.");
        const response = JSON.parse(request.responseText) as { storageId?: Id<"_storage"> };
        if (!response.storageId) throw new Error("Upload did not return a storage reference. Please retry.");
        resolve(response.storageId);
      } catch (error) { reject(error); }
    };
    request.onerror = () => { finish(); reject(new Error("Connection interrupted. Please retry.")); };
    request.ontimeout = () => { finish(); reject(new Error("Upload timed out. Please retry.")); };
    request.onabort = () => { finish(); reject(new Error("Upload cancelled.")); };
    request.send(file);
  });
}

export function VehicleMediaEditor({ value, legacyPhotos, onChange, onLegacyChange, onBusyChange, disabled = false }: Props) {
  const beginUpload = useAction(api.media.beginUpload);
  const finalizeUpload = useAction(api.media.finalizeUpload);
  const deleteUpload = useMutation(api.media.deleteUpload);
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [error, setError] = useState("");
  const [pendingDeletes, setPendingDeletes] = useState(0);
  const entriesRef = useRef(entries);
  const activeUploads = useRef(new Set<string>());
  const requests = useRef(new Set<XMLHttpRequest>());
  const mounted = useRef(true);
  const valueRef = useRef(value);
  valueRef.current = value;
  entriesRef.current = entries;
  const busy = pendingDeletes > 0 || entries.some(entry => entry.status !== "ready");
  useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);
  useEffect(() => {
    const activeRequests = requests.current;
    mounted.current = true;
    return () => { mounted.current = false; for (const request of activeRequests) request.abort(); };
  }, []);

  const updateEntry = (key: string, updates: Partial<UploadEntry>) => {
    if (mounted.current) setEntries(previous => previous.map(entry => entry.key === key ? { ...entry, ...updates } : entry));
  };
  const startUpload = async (entry: UploadEntry) => {
    if (!entry.file || activeUploads.current.has(entry.key)) return;
    activeUploads.current.add(entry.key);
    updateEntry(entry.key, { status: "uploading", progress: 0, error: undefined });
    let mediaId: Id<"vehicleMedia"> | undefined;
    try {
      const upload = await beginUpload({});
      mediaId = upload.mediaId;
      if (!mounted.current) { await deleteUpload({ mediaId }); return; }
      const storageId = await uploadFile(upload.uploadUrl, entry.file, percentage => updateEntry(entry.key, { progress: percentage }), requests.current);
      updateEntry(entry.key, { status: "processing", progress: 100 });
      const result = await finalizeUpload({ mediaId, storageId });
      if (!mounted.current) return;
      const previous = entry.replaces ? valueRef.current.find(item => item.id === entry.replaces) : undefined;
      const media = { ...result, caption: previous?.caption ?? "" };
      const next = previous ? valueRef.current.map(item => item.id === previous.id ? media : item) : [...valueRef.current, media];
      valueRef.current = next;
      onChange(next);
      updateEntry(entry.key, { media, status: "ready", file: undefined });
    } catch (failure) {
      if (mediaId) await deleteUpload({ mediaId }).catch(() => undefined);
      updateEntry(entry.key, { status: "failed", error: failure instanceof Error ? failure.message : "Unable to upload. Please retry." });
    } finally { activeUploads.current.delete(entry.key); }
  };
  const chooseFiles = (files: FileList | null, replaces?: string) => {
    if (!files) return;
    setError("");
    const selected = Array.from(files);
    if (!selected.length) return;
    const pendingCount = entriesRef.current.filter(entry => entry.status !== "ready" && !entry.replaces).length;
    if (!replaces && value.length + legacyPhotos.length + pendingCount + selected.length > MAX_PHOTOS) { setError("A listing can have up to 30 photos."); return; }
    if (selected.some(file => !ALLOWED_TYPES.has(file.type) || file.size > MAX_UPLOAD_BYTES || file.size === 0)) { setError("Choose JPEG, PNG, or WebP photos, each no larger than 10 MiB."); return; }
    const next = selected.map(file => ({ key: crypto.randomUUID(), file, status: "uploading" as const, progress: 0, replaces }));
    onBusyChange(true);
    setEntries(previous => [...previous, ...next]);
    for (const entry of next) void startUpload(entry);
  };
  const remove = async (media: ListingMedia) => {
    onBusyChange(true);
    setPendingDeletes(count => count + 1);
    const next = valueRef.current.filter(item => item.id !== media.id);
    valueRef.current = next;
    onChange(next);
    setEntries(previous => previous.filter(entry => entry.media?.id !== media.id));
    try {
      // Attached media is detached and cleaned up by the listing save; new uploads can be deleted immediately.
      await deleteUpload({ mediaId: media.id });
    } catch { /* Existing attachments are deleted when the listing is saved. */ }
    finally { if (mounted.current) setPendingDeletes(count => count - 1); }
  };
  const move = (index: number, direction: number) => {
    const next = [...valueRef.current];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    valueRef.current = next;
    onChange(next);
  };
  const changeCaption = (id: Id<"vehicleMedia">, caption: string) => {
    const next = valueRef.current.map(item => item.id === id ? { ...item, caption } : item);
    valueRef.current = next;
    onChange(next);
  };
  return (
    <div className="space-y-4">
      <div className="rounded-lg border-2 border-dashed border-border p-6">
        <label htmlFor="vehicle-photo-upload" className="block font-medium">Vehicle photos</label>
        <p id="vehicle-photo-help" className="my-2 text-sm text-muted-foreground">JPEG, PNG, or WebP, up to 10 MiB each. Up to 30 photos. Photos are processed before your listing is saved.</p>
        <input id="vehicle-photo-upload" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled} aria-describedby="vehicle-photo-help" onChange={event => { chooseFiles(event.target.files); event.target.value = ""; }} className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-2" />
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {entries.filter(entry => entry.status !== "ready").map(entry => (
        <div key={entry.key} className="space-y-2 rounded-lg border p-3" aria-busy={entry.status !== "failed"}>
          <p className="truncate text-sm font-medium">{entry.file?.name}</p>
          {entry.status === "failed" ? <><p role="alert" className="text-sm text-red-700">{entry.error}</p><Button type="button" variant="outline" disabled={disabled} onClick={() => void startUpload(entry)}>Retry upload</Button><Button type="button" variant="ghost" disabled={disabled} onClick={() => setEntries(previous => previous.filter(item => item.key !== entry.key))}>Remove</Button></> : <><progress max={100} value={entry.progress} aria-label={`Uploading ${entry.file?.name}`} className="w-full" /><p role="status" className="text-sm text-muted-foreground">{entry.status === "processing" ? "Processing photo..." : `Uploading ${entry.progress}%`}</p></>}
        </div>
      ))}
      {legacyPhotos.length > 0 && <div className="space-y-2"><p className="text-sm text-muted-foreground">Existing photos appear first. Replace existing photos by removing them and uploading a new file.</p>{legacyPhotos.map((photo, index) => <div key={`${index}-${photo}`} className="flex items-center gap-3 rounded-lg border p-3">{isTrustedImageUrl(photo) ? <Image src={photo} width={96} height={72} alt={`Existing photo ${index + 1}`} className="h-16 w-24 rounded object-cover" /> : <span className="text-sm">Photo unavailable</span>}<Button type="button" variant="outline" onClick={() => { const next = [...legacyPhotos]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onLegacyChange(next); }} aria-label={`Move existing photo ${index + 1} earlier`} disabled={disabled || index === 0}>Earlier</Button><Button type="button" variant="ghost" disabled={disabled} onClick={() => onLegacyChange(legacyPhotos.filter((_, position) => position !== index))}>Remove</Button></div>)}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        {value.map((media, index) => <div key={media.id} className="space-y-3 rounded-lg border p-3">
          {isTrustedImageUrl(media.thumbnailUrl) ? <Image src={media.thumbnailUrl} alt={media.caption || `Vehicle photo ${index + 1}`} width={400} height={300} className="h-40 w-full rounded object-cover" /> : <div className="flex h-40 items-center justify-center bg-muted text-sm">Photo unavailable</div>}
          <label className="block text-sm">Caption<Input value={media.caption} maxLength={200} disabled={disabled} onChange={event => changeCaption(media.id, event.target.value)} placeholder="Optional photo caption" /></label>
          <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={disabled || index === 0} onClick={() => move(index, -1)} aria-label={`Move photo ${index + 1} earlier`}>Earlier</Button><Button type="button" variant="outline" disabled={disabled || index === value.length - 1} onClick={() => move(index, 1)} aria-label={`Move photo ${index + 1} later`}>Later</Button><Button type="button" variant="ghost" disabled={disabled || entries.some(entry => entry.replaces === media.id && entry.status !== "ready")} onClick={() => void remove(media)}>Delete</Button></div>
          <label className="block text-sm">Replace photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || entries.some(entry => entry.replaces === media.id && entry.status !== "ready")} aria-label={`Replace photo ${index + 1}`} className="mt-1 block w-full text-xs" onChange={event => { chooseFiles(event.target.files, media.id); event.target.value = ""; }} /></label>
        </div>)}
      </div>
      {busy && <p className="text-sm text-muted-foreground" role="status">Finish uploads, or remove failed photos, before saving your listing.</p>}
    </div>
  );
}
