"use client";

import { Button } from "@/components/ui/button";
import { isTrustedImageUrl } from "@/lib/trusted-images";
import { cn } from "@/lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import { Car, ChevronLeft, ChevronRight, Expand, ImageOff, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import type { KeyboardEvent, TouchEvent } from "react";

interface VehiclePhotoCarouselProps {
  photos: string[];
  thumbnailPhotos?: string[];
  captions?: string[];
  title: string;
  vehicleLabel: string;
  className?: string;
}

function PhotoFallback({ vehicleLabel, unavailable }: { vehicleLabel: string; unavailable: boolean }) {
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden bg-[hsl(var(--midnight))] p-4 text-[hsl(var(--bone))] sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(hsl(var(--bone)/0.04)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--bone)/0.04)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center py-3 text-center">
        <p className="mb-2 hidden sm:block font-mono text-[10px] uppercase tracking-[0.2em] text-primary">A closer look, coming soon</p>
        <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">{unavailable ? "Photo unavailable" : "Photos coming soon"}</h3>
        <p className="mt-3 text-sm leading-6 text-[hsl(var(--chrome))]">{unavailable ? "This photo couldn’t be loaded. Explore the vehicle details below." : "The seller hasn’t shared photos yet. Explore the vehicle details below."}</p>
      </div>
      <div className="relative flex items-center justify-between gap-4 border-t border-white/15 pt-3">
        <span className="truncate font-mono text-xs text-[hsl(var(--chrome))]">{vehicleLabel}</span>
        <ImageOff aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
      </div>
    </div>
  );
}

export function VehiclePhotoCarousel({ photos, thumbnailPhotos, captions, title, vehicleLabel, className }: VehiclePhotoCarouselProps) {
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.min(selected, Math.max(0, photos.length - 1));
  const source = photos[index];
  const available = Boolean(source && isTrustedImageUrl(source) && !failed.has(source));

  const markFailed = (photo: string) => setFailed(prev => new Set(prev).add(photo));
  const select = (next: number) => {
    const position = (next + photos.length) % photos.length;
    setSelected(position);
    thumbnailRefs.current[position]?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (photos.length < 2) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      select(index + (event.key === "ArrowLeft" ? -1 : 1));
    }
  };
  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    const end = event.changedTouches[0];
    if (!start || !end || photos.length < 2) return;
    const dx = end.clientX - start.x;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(end.clientY - start.y)) {
      event.preventDefault();
      select(index + (dx < 0 ? 1 : -1));
    }
  };
  const navigation = photos.length > 1 && (
    <>
      <Button type="button" variant="outline" size="icon" aria-label="Previous photo" className="absolute left-3 top-1/2 z-10 -translate-y-1/2 border-white/20 bg-[hsl(var(--midnight)/0.8)] text-white hover:bg-primary hover:text-primary-foreground" onClick={() => select(index - 1)}><ChevronLeft aria-hidden="true" className="h-5 w-5" /></Button>
      <Button type="button" variant="outline" size="icon" aria-label="Next photo" className="absolute right-3 top-1/2 z-10 -translate-y-1/2 border-white/20 bg-[hsl(var(--midnight)/0.8)] text-white hover:bg-primary hover:text-primary-foreground" onClick={() => select(index + 1)}><ChevronRight aria-hidden="true" className="h-5 w-5" /></Button>
    </>
  );
  const counter = photos.length > 0 && <span aria-live="polite" aria-atomic="true" className="font-mono text-xs tabular-nums">Photo {index + 1} / {photos.length}{!available ? " · Unavailable" : ""}</span>;

  return (
    <Dialog.Root open={expanded} onOpenChange={setExpanded}>
      <section aria-label={`${title} photos`} aria-roledescription="carousel" onKeyDown={handleKeyDown} className={cn("overflow-hidden rounded-xl border border-border bg-card shadow-sm", className)}>
        <div className="relative w-full aspect-[4/3] min-h-80 bg-[hsl(var(--midnight))] sm:aspect-[16/10]" onTouchStart={event => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }} onTouchEnd={handleTouchEnd} onTouchCancel={() => { touchStart.current = null; }}>
          {available ? (
            <Dialog.Trigger asChild>
              <button type="button" aria-label={`Enlarge photo ${index + 1} of ${title}`} className="relative block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
                <Image key={source} src={source} alt={captions?.[index] || `${title} — photo ${index + 1}`} fill sizes="(max-width: 1024px) 100vw, 800px" className="object-contain" onError={() => markFailed(source)} />
                <span className="absolute right-4 top-4 flex items-center gap-2 rounded-md bg-black/65 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white"><Expand aria-hidden="true" className="h-3.5 w-3.5" /> Expand</span>
              </button>
            </Dialog.Trigger>
          ) : <PhotoFallback vehicleLabel={vehicleLabel} unavailable={photos.length > 0} />}
          {navigation}
        </div>
        <div className="flex min-h-12 items-center justify-between gap-3 border-t border-border px-4 py-3 text-muted-foreground">
          <span className="font-mono text-[10px] uppercase tracking-wider">Vehicle gallery</span>
          {captions?.[index] && <span className="min-w-0 break-words text-sm">{captions[index]}</span>}
          {counter || <span className="font-mono text-xs">No photos yet</span>}
        </div>
        {photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto border-t border-border p-3" aria-label="Choose a vehicle photo">
            {photos.map((photo, position) => {
              const thumbnail = isTrustedImageUrl(thumbnailPhotos?.[position] ?? "") ? thumbnailPhotos![position] : photo;
              return (
              <button type="button" key={`${position}-${photo}`} ref={element => { thumbnailRefs.current[position] = element; }} aria-label={`Show photo ${position + 1}${!isTrustedImageUrl(photo) || failed.has(photo) ? " (unavailable)" : ""}`} aria-pressed={index === position} onClick={() => select(position)} className={cn("relative h-16 w-24 shrink-0 overflow-hidden rounded-md border-2 bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2", index === position ? "border-primary" : "border-transparent hover:border-primary/40")}>
                {isTrustedImageUrl(thumbnail) && !failed.has(thumbnail) ? <Image src={thumbnail} alt="" fill sizes="96px" className="object-cover" onError={() => markFailed(thumbnail)} /> : <span className="flex h-full items-center justify-center bg-[hsl(var(--midnight))]"><Car aria-hidden="true" className="h-6 w-6 text-primary" /></span>}
              </button>
              );
            })}
          </div>
        )}
      </section>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[hsl(var(--midnight)/0.95)]" />
        <Dialog.Content onKeyDown={handleKeyDown} className="fixed inset-x-3 top-1/2 z-50 mx-auto max-h-[calc(100dvh-2rem)] max-w-6xl -translate-y-1/2 overflow-y-auto rounded-xl border border-white/15 bg-[hsl(var(--midnight))] p-3 text-white shadow-2xl sm:inset-x-6 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div><Dialog.Title className="font-semibold">{title}</Dialog.Title><Dialog.Description className="mt-1 text-xs text-[hsl(var(--chrome))]">{photos.length > 1 ? "Use the arrows or swipe to browse vehicle photos." : "Vehicle photo"}</Dialog.Description></div>
            <Dialog.Close asChild><Button type="button" variant="outline" size="icon" aria-label="Close photo gallery"><X aria-hidden="true" className="h-5 w-5" /></Button></Dialog.Close>
          </div>
          <div className="relative h-[60vh] min-h-80 sm:h-[70vh]" onTouchStart={event => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }} onTouchEnd={handleTouchEnd} onTouchCancel={() => { touchStart.current = null; }}>
            {available ? <Image key={source} src={source} alt={captions?.[index] || `${title} — photo ${index + 1}`} fill sizes="100vw" className="object-contain" onError={() => markFailed(source)} /> : <PhotoFallback vehicleLabel={vehicleLabel} unavailable={photos.length > 0} />}
            {navigation}
          </div>
          <div className="mt-4 text-center text-[hsl(var(--chrome))]">{captions?.[index] && <p className="mb-2 text-sm">{captions[index]}</p>}{counter}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
