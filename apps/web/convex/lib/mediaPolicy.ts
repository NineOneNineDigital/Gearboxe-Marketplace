export const REQUIRED_PHOTO_VIEWS = ["front", "rear", "left side", "right side", "interior"] as const;
export type PhotoView = typeof REQUIRED_PHOTO_VIEWS[number];
export const MIN_PHOTOS = REQUIRED_PHOTO_VIEWS.length;
export function missingPhotoViews(refs: readonly { view?: PhotoView }[]) {
  return REQUIRED_PHOTO_VIEWS.filter(view => !refs.some(ref => ref.view === view));
}

export const MAX_PHOTOS = 30;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;
export const MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function assertUploadMetadata(mime: string, size: number): void {
  if (!MIME_TYPES.some((allowed) => allowed === mime)) {
    throw new Error("Photos must be JPEG, PNG, or WebP images.");
  }
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_UPLOAD_BYTES) {
    throw new Error("Photos must be nonempty and no larger than 10 MiB.");
  }
}
